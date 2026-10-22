import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {createMockCustomerClaimsDesk} from '../src/server/mock-customer-claims-desk.mjs';
const secret='mock-secret-minimum-32-characters-not-real';
const make=()=>{
 const lifecycle=createMockPaymentLifecycle({webhookSecret:secret,clock:()=>1700000000000});
 const claims=createMockCustomerClaimsDesk({lifecycle,clock:()=>1700000000000});
 const order=lifecycle.createMockOrder({requestId:'customer-claims-order-0001',destination:'HN',amountCents:10000});
 return {lifecycle,claims,order};
};
const event=(m,order,phase,id)=>{
 const e=m.makeTestWebhook({orderId:order.orderId,phase,eventId:id});
 return m.acceptTestWebhook(e);
};
test('alegación duplicada crea un solo caso y no certifica un cargo',()=>{
 const {claims,order,lifecycle}=make();
 const args={requestId:'claim-duplicate-report-01',orderId:order.orderId,reason:'reported_duplicate_charge'};
 const first=claims.reportMockClaim(args);
 assert.equal(first.allegedChargeVerified,false);
 assert.equal(first.customerRefundVerified,false);
 assert.equal(first.canAutoRefund,false);
 assert.equal(first.realMoneyEnabled,false);
 assert.equal(claims.reportMockClaim(args).alreadyProcessed,true);
 assert.equal(claims.reportMockClaim({...args,requestId:'claim-duplicate-report-02'}).caseId,first.caseId);
 assert.equal(claims.listMockClaims().length,1);
 assert.equal(claims.getMockClaimAudit().length,1);
 assert.equal(lifecycle.inspectMockOrder(order.orderId).status,'created_mock');
});
test('no permite reutilizar la clave con otra orden o razón',()=>{
 const {claims,order}=make();
 claims.reportMockClaim({requestId:'claim-request-123456',orderId:order.orderId,reason:'reported_missing_refund'});
 assert.throws(()=>claims.reportMockClaim({requestId:'claim-request-123456',orderId:order.orderId,reason:'reported_missing_payout'}),/datos distintos/);
 assert.throws(()=>claims.reportMockClaim({requestId:'claim-invalid-id-01',orderId:order.orderId,reason:'unsupported_reason'}),/Motivo/);
 assert.equal(claims.listMockClaims().length,1);
});
test('detecta fallos reiterados sin tramitar un nuevo reembolso',()=>{
 const {claims,order,lifecycle}=make();
 event(lifecycle,order,'funding_settled_mock','claim-funding-event-001');
 lifecycle.requestMockRefund({orderId:order.orderId,requestId:'claim-first-refund-001'});
 event(lifecycle,order,'refund_failed_mock','claim-refund-failed-001');
 lifecycle.retryMockRefundAfterFailure({orderId:order.orderId,requestId:'claim-second-refund-01'});
 event(lifecycle,order,'refund_failed_mock','claim-refund-failed-002');
 const row=claims.reportMockClaim({requestId:'claim-report-refund-001',orderId:order.orderId,reason:'reported_missing_refund'});
 assert.equal(row.refundFailuresObserved,2);
 assert.equal(row.followUp,'escalate_repeated_refund_failures_mock');
 assert.equal(row.canAutoRefund,false);
 assert.equal(lifecycle.inspectMockOrder(order.orderId).status,'refund_failed_mock');
});
test('caso pagado exige comprobar evidencia sin declarar devolución',()=>{
 const {claims,order,lifecycle}=make();
 event(lifecycle,order,'funding_settled_mock','claim-funding-event-002');
 lifecycle.requestMockPayout({orderId:order.orderId,requestId:'claim-payout-request-001'});
 event(lifecycle,order,'payout_settled_mock','claim-payout-settled-01');
 const c=claims.reportMockClaim({requestId:'claim-report-payout-01',orderId:order.orderId,reason:'reported_missing_payout'});
 assert.equal(c.followUp,'compare_simulated_receipt_with_external_evidence_mock');
 assert.equal(c.customerPayoutVerified,false);
 assert.equal(c.canAutoPayout,false);
 assert.equal(lifecycle.inspectMockOrder(order.orderId).status,'paid_mock');
});
test('rechaza inicialización fuera de simulación y referencias desconocidas',()=>{
 assert.throws(()=>createMockCustomerClaimsDesk({lifecycle:{mode:'live',canMoveRealMoney:true}}),/sólo para simulación/);
 const {claims}=make();
 assert.throws(()=>claims.reportMockClaim({requestId:'claim-unknown-order-1',orderId:'00000000-0000-4000-8000-000000000000',reason:'reported_missing_refund'}),/inexistente/);
});
