import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {reconcileMockTransfer,createMockAuditTrail} from '../src/server/mock-transfer-reconciliation.mjs';
const secret='mock-only-secret-for-reconciliation-1234567',clock=()=>1700000000000;
const setup=()=>createMockPaymentLifecycle({webhookSecret:secret,clock});
function sample(m,destination='HN'){
 return m.createMockOrder({requestId:'order-reconcile-'+destination+'-001',destination,amountCents:10000});
}
function notify(m,o,phase,id){
 return m.acceptTestWebhook(m.makeTestWebhook({orderId:o.orderId,phase,eventId:'event-reconcile-'+id+'-001'}));
}
const statements=(o,phases)=>phases.map(phase=>({
 reference:'DEMO_'+o.orderId.replaceAll('-','')+'_'+phase,
 phase,amountCents:o.amountCents,currency:'USD',source:'manual_mock_fixture',status:'settled_mock',
}));
test('conciliación ficticia de pago confirma sólo coincidencia de fixtures',()=>{
 const m=setup(),o=sample(m);
 notify(m,o,'funding_settled_mock','fund');
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-reconcile-001'});
 notify(m,o,'payout_settled_mock','paid');
 const state=m.inspectMockOrder(o.orderId);
 const result=reconcileMockTransfer({order:state,proposals:m.getAccountingProposals(o.orderId),
  statementRows:statements(state,['funding_settled_mock','payout_settled_mock']),
  statementId:'statement-reconcile-001'});
 assert.equal(result.status,'matched_mock');
 assert.equal(result.realLedgerPosted,false);assert.equal(result.eligibleForRealPayout,false);
});
test('reembolso en Nicaragua no permite registro de pago contradictorio',()=>{
 const m=setup(),o=sample(m,'NI');
 notify(m,o,'funding_settled_mock','fund2');
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-reconcile-002'});
 notify(m,o,'payout_failed_mock','failed');
 m.requestMockRefund({orderId:o.orderId,requestId:'refund-reconcile-002'});
 notify(m,o,'refund_settled_mock','refunded');
 const state=m.inspectMockOrder(o.orderId);
 const result=reconcileMockTransfer({order:state,proposals:m.getAccountingProposals(o.orderId),
  statementRows:statements(state,['funding_settled_mock','refund_settled_mock']),
  statementId:'statement-reconcile-002'});
 assert.equal(result.status,'matched_mock');assert.equal(state.destination,'NI');
 const wrong=statements(state,['funding_settled_mock','payout_settled_mock']);
 assert.equal(reconcileMockTransfer({order:state,proposals:m.getAccountingProposals(o.orderId),
  statementRows:wrong,statementId:'statement-reconcile-003'}).requiresHumanReview,true);
});
test('extracto incompleto, importes cambiados y duplicados generan alerta',()=>{
 const m=setup(),o=sample(m);
 notify(m,o,'funding_settled_mock','fund3');
 const state=m.inspectMockOrder(o.orderId),one=statements(state,['funding_settled_mock']);
 const proposals=m.getAccountingProposals(o.orderId);
 assert.equal(reconcileMockTransfer({order:state,proposals,statementRows:[],
  statementId:'statement-reconcile-004'}).requiresHumanReview,true);
 assert.equal(reconcileMockTransfer({order:state,proposals,statementRows:[...one,...one],
  statementId:'statement-reconcile-005'}).requiresHumanReview,true);
 assert.equal(reconcileMockTransfer({order:state,proposals,statementRows:[{...one[0],amountCents:9000}],
  statementId:'statement-reconcile-006'}).requiresHumanReview,true);
 assert.throws(()=>reconcileMockTransfer({order:state,proposals:[{...proposals[0],verifiedBankFunds:true}],
  statementRows:one,statementId:'statement-reconcile-007'}),/Propuesta/);
});
test('hash auditado de ejemplo detecta alteración y repetición conflictiva',()=>{
 const m=setup(),o=sample(m);
 const a=createMockAuditTrail();
 const event={eventId:'audit-event-0000001',orderId:o.orderId,kind:'reconciliation_mock',status:'pending_mock'};
 const x=a.append(event);
 assert.equal(a.append(event).alreadyProcessed,true);
 assert.equal(a.verify(),true);
 assert.throws(()=>a.append({...event,status:'matched_mock'}),/Idempotencia/);
 const rows=a.entries().map(x=>({...x,status:'matched_mock'}));
 assert.equal(a.verify(rows),false);
 assert.equal(x.previousHash,'0'.repeat(64));
 assert.equal(a.realAuditEnabled,false);
});

test('cancelación antes de financiación cierra SIN extracto ni entradas contables',()=>{
 const m=setup(),o=sample(m,'NI');
 m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-reconciliation-001'});
 const state=m.inspectMockOrder(o.orderId);
 const r=reconcileMockTransfer({order:state,proposals:[],statementRows:[],
 statementId:'statement-unfunded-cancel-001'});
 assert.equal(r.status,'closed_without_funds_mock');
 assert.equal(r.expectedEvents,0);
 assert.equal(r.realLedgerPosted,false);
 assert.equal(r.eligibleForRealPayout,false);
 const audit=createMockAuditTrail();
 audit.append({eventId:'audit-cancel-example-001',orderId:o.orderId,kind:'reconciliation_mock',status:r.status});
 assert.equal(audit.verify(),true);
});
test('una orden cancelada con extracto ficticio inesperado requiere revisión',()=>{
 const m=setup(),o=sample(m);
 m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-reconciliation-002'});
 const state=m.inspectMockOrder(o.orderId);
 const fake=statements(state,['funding_settled_mock']);
 const r=reconcileMockTransfer({order:state,proposals:[],statementRows:fake,
 statementId:'statement-cancel-conflict-002'});
 assert.equal(r.status,'manual_review_mock');
 assert.ok(r.issues.includes('unexpected_statement_record'));
});
