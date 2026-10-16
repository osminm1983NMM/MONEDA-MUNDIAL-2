import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {reconcileMockBatch} from '../src/server/mock-batch-reconciliation.mjs';
const secret='only-for-reconciliation-tests-000000000';
const make=()=>createMockPaymentLifecycle({webhookSecret:secret,clock:()=>1700000000000});
const fixture=(m,destination,number)=>{
 const order=m.createMockOrder({destination,amountCents:10000,
   requestId:'batch-order-request-'+number+'-001'});
 function notify(phase,id){m.acceptTestWebhook(m.makeTestWebhook({
  orderId:order.orderId,phase,eventId:'batch-event-'+number+'-'+id+'-0001'}));}
 notify('funding_settled_mock','fund');
 m.requestMockPayout({orderId:order.orderId,requestId:'batch-payout-'+number+'-0001'});
 notify('payout_settled_mock','paid');
 const state=m.inspectMockOrder(order.orderId);
 const phases=['funding_settled_mock','payout_settled_mock'];
 const statementRows=phases.map(phase=>({
   reference:'DEMO_'+state.orderId.replaceAll('-','')+'_'+phase,
   phase,amountCents:state.amountCents,currency:'USD',
   source:'manual_mock_fixture',status:'settled_mock'
 }));
 return {caseId:'mock-case-'+number+'-0001',order:state,
  proposals:m.getAccountingProposals(state.orderId),statementRows,
  statementId:'mock-statement-'+number+'-0001'};
};
test('conciliar dos pagos ficticios sin habilitar dinero real',()=>{
 const m=make(),cases=[fixture(m,'HN','one'),fixture(m,'NI','two')];
 const r=reconcileMockBatch({batchId:'batch-test-0001',cases});
 assert.equal(r.totalCases,2);
 assert.equal(r.matchedFictionalFixtures,2);
 assert.equal(r.manualReviewCases,0);
 assert.equal(r.realBankStatementsVerified,false);
 assert.equal(r.canAutoSettle,false);
 assert.ok(r.cases.every(x=>x.realPaymentsEnabled===false&&!x.canDisburse));
});
test('una referencia entre dos órdenes ficticias requiere revisión manual',()=>{
 const m=make(),a=fixture(m,'HN','three'),b=fixture(m,'NI','four');
 // Insertar una referencia de otra orden, que el mismo motor
 // de conciliación individual considera inesperada.
 b.statementRows.push(a.statementRows[0]);
 const result=reconcileMockBatch({batchId:'batch-test-0002',cases:[a,b]});
 assert.equal(result.manualReviewCases,2);
 assert.ok(result.cases.every(c=>c.issues.includes('reference_reused_across_cases')));
 assert.equal(result.matchedFictionalFixtures,0);
});
test('repetir órdenes, identificadores o extractos en lote se detecta',()=>{
 const m=make(),a=fixture(m,'HN','five'),b=fixture(m,'NI','six');
 const x=reconcileMockBatch({batchId:'batch-test-0003',cases:[
  a,{...b,statementId:a.statementId}]});
 assert.ok(x.cases.every(c=>c.issues.includes('duplicate_statement_id')));
 const y=reconcileMockBatch({batchId:'batch-test-0004',cases:[
  a,{...a,caseId:'mock-case-reuse-0001',statementId:'statement-new-0001'}]});
 assert.ok(y.cases.every(c=>c.issues.includes('duplicate_order_in_batch')));
});
test('rechaza fixtures alterados o que pretendan activar pagos y mantiene vacío seguro',()=>{
 const m=make(),a=fixture(m,'HN','seven');
 assert.throws(()=>reconcileMockBatch({batchId:'invalid',cases:[a]}),/inválido/);
 assert.throws(()=>reconcileMockBatch({batchId:'batch-test-0005',
  cases:[{...a,realMoneyEnabled:true}]}),/inválido/);
 assert.throws(()=>reconcileMockBatch({batchId:'batch-test-0006',
  cases:[{...a,order:{...a.order,realMoneyEnabled:true}}]}),/inválida/);
 assert.throws(()=>reconcileMockBatch({batchId:'batch-test-0007',
  cases:[{...a,statementRows:[{...a.statementRows[0],source:'real_bank'}]}]}),/inválido/);
 const empty=reconcileMockBatch({batchId:'batch-test-0008',cases:[]});
 assert.equal(empty.totalCases,0);
 assert.equal(empty.canDisburse,false);
});
