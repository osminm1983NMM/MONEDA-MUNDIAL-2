import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
const secret='only-for-mock-32-characters-very-long';
let t=1700000000000;
const make=()=>createMockPaymentLifecycle({webhookSecret:secret,clock:()=>t});
const create=(m,destination='HN')=>m.createMockOrder({requestId:'order-request-'+destination+'-0001',destination,amountCents:10000});
function emit(m,o,phase,n){
 const msg=m.makeTestWebhook({orderId:o.orderId,phase,eventId:'event-'+n+'-123456'});
 return m.acceptTestWebhook(msg);
}
test('ni confirmaciones de laboratorio generan dinero o asientos',()=>{
 const m=make(),o=create(m);
 assert.equal(m.canMoveRealMoney,false);
 assert.equal(m.getAccountingProposals(o.orderId).length,0);
 assert.throws(()=>m.requestMockPayout({orderId:o.orderId,requestId:'payout-request-0001'}),/prohibida/);
 const e=emit(m,o,'funding_settled_mock','funded');
 assert.equal(e.status,'funded_mock');
 assert.equal(e.ledgerAutomaticallyPosted,false);
 const proposals=m.getAccountingProposals(o.orderId);
 assert.equal(proposals.length,1);
 assert.equal(proposals[0].canPostToLiveLedger,false);
 assert.equal(proposals[0].lines[0].side,'debit');
});
test('desembolso y devolución son estados finales excluyentes',()=>{
 const m=make(),o=create(m);
 emit(m,o,'funding_settled_mock','funded');
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-request-0001'});
 emit(m,o,'payout_settled_mock','paid');
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
 assert.throws(()=>m.requestMockRefund({orderId:o.orderId,requestId:'refund-request-0001'}),/No hay/);
 assert.equal(m.getAccountingProposals(o.orderId).length,2);
 const q=make(),p=create(q,'NI');
 emit(q,p,'funding_settled_mock','funded');
 q.requestMockPayout({orderId:p.orderId,requestId:'payout-request-0002'});
 emit(q,p,'payout_failed_mock','fail');
 q.requestMockRefund({orderId:p.orderId,requestId:'refund-request-0002'});
 emit(q,p,'refund_settled_mock','refund');
 assert.equal(q.inspectMockOrder(p.orderId).status,'refunded_mock');
 assert.equal(q.getAccountingProposals(p.orderId).length,2);
 assert.throws(()=>q.requestMockPayout({orderId:p.orderId,requestId:'payout-request-0003'}),/prohibida/);
});
test('eventos duplicados, adulterados o fuera de orden se rechazan',()=>{
 const m=make(),o=create(m);
 const e=m.makeTestWebhook({orderId:o.orderId,phase:'funding_settled_mock',eventId:'event-test-00123456'});
 assert.throws(()=>m.acceptTestWebhook({...e,rawBody:e.rawBody+' '}),/Firma/);
 assert.equal(m.acceptTestWebhook(e).duplicate,false);
 assert.equal(m.acceptTestWebhook(e).duplicate,true);
 assert.equal(m.getAccountingProposals(o.orderId).length,1);
 const newOrder=create(m,'NI');
 assert.throws(()=>emit(m,newOrder,'refund_settled_mock','early'),/prohibida/);
 assert.equal(m.inspectMockOrder(newOrder.orderId).status,'created_mock');
});
test('reintentos son idempotentes y no modifican órdenes anteriores',()=>{
 const m=make(),o=create(m);
 assert.equal(create(m).alreadyProcessed,true);
 assert.throws(()=>m.createMockOrder({requestId:'order-request-HN-0001',destination:'HN',amountCents:10001}),/reutilizada/);
 emit(m,o,'funding_settled_mock','funded');
 const request='payout-request-0004';
 m.requestMockPayout({orderId:o.orderId,requestId:request});
 assert.equal(m.requestMockPayout({orderId:o.orderId,requestId:request}).alreadyProcessed,true);
});
test('rechaza acceso a modo producción',()=>{
 assert.throws(()=>createMockPaymentLifecycle({mode:'live',webhookSecret:secret}),/DESHABILITADAS/);
});

test('cancelar orden no financiada evita notificaciones de fondeo posteriores',()=>{
 const m=make(),o=create(m);
 const first=m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-before-funds-0001'});
 assert.equal(first.status,'cancelled_mock');
 assert.equal(first.realMoneyEnabled,false);
 assert.equal(m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-before-funds-0001'}).alreadyProcessed,true);
 assert.throws(()=>m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-before-funds-0002'}),/prohibida/);
 assert.throws(()=>emit(m,o,'funding_settled_mock','after-cancel'),/prohibida/);
 assert.throws(()=>m.requestMockRefund({orderId:o.orderId,requestId:'refund-after-cancel-001'}),/No hay/);
 assert.equal(m.getAccountingProposals(o.orderId).length,0);
 assert.equal(m.getAuditLog().filter(x=>x.type==='order_cancelled_unfunded_mock').length,1);
});
test('una orden pagada o en salida pendiente no se cancela unilateralmente',()=>{
 const m=make(),o=create(m,'NI');
 emit(m,o,'funding_settled_mock','before-payout');
 assert.throws(()=>m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-after-funds-0001'}),/prohibida/);
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-before-cancel-01'});
 assert.throws(()=>m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-payout-pending-01'}),/prohibida/);
 assert.throws(()=>m.requestMockRefund({orderId:o.orderId,requestId:'refund-payout-pending-01'}),/No hay/);
 emit(m,o,'payout_settled_mock','already-paid');
 assert.throws(()=>m.cancelMockBeforeFunding({orderId:o.orderId,requestId:'cancel-already-paid-01'}),/prohibida/);
 assert.throws(()=>m.requestMockRefund({orderId:o.orderId,requestId:'refund-already-paid-001'}),/No hay/);
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
});

test('reintento tardío del evento original mantiene su estado de aceptación',()=>{
 const m=make(),o=create(m);
 const original=m.makeTestWebhook({orderId:o.orderId,phase:'funding_settled_mock',eventId:'event-funding-replay-999'});
 assert.equal(m.acceptTestWebhook(original).status,'funded_mock');
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-late-replay-001'});
 emit(m,o,'payout_settled_mock','later-complete');
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
 const retry=m.acceptTestWebhook(original);
 assert.equal(retry.duplicate,true);
 assert.equal(retry.status,'funded_mock');
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
 assert.equal(m.getAccountingProposals(o.orderId).length,2);
 assert.equal(m.getAuditLog().filter(x=>x.type==='funding_settled_mock').length,1);
 assert.equal(retry.realMoneyEnabled,false);
});

test('reintento de creación conserva estado original tras supuesto pago',()=>{
 const m=make(),created=create(m);
 emit(m,created,'funding_settled_mock','fund-create');
 m.requestMockPayout({orderId:created.orderId,requestId:'pay-create-123456'});
 emit(m,created,'payout_settled_mock','settled-create');
 assert.equal(m.inspectMockOrder(created.orderId).status,'paid_mock');
 const retry=create(m);
 assert.equal(retry.status,'created_mock');
 assert.equal(retry.alreadyProcessed,true);
 assert.equal(retry.orderId,created.orderId);
 assert.equal(m.getAuditLog().filter(x=>x.type==='order_created_mock').length,1);
});
test('reintentos tardíos de acción no aparentan un estado distinto',()=>{
 const m=make(),o=create(m,'NI');
 emit(m,o,'funding_settled_mock','fund-act');
 const actionId='pay-action-replay-001';
 assert.equal(m.requestMockPayout({orderId:o.orderId,requestId:actionId}).status,'payout_pending_mock');
 emit(m,o,'payout_settled_mock','paid-action');
 const retry=m.requestMockPayout({orderId:o.orderId,requestId:actionId});
 assert.equal(retry.status,'payout_pending_mock');
 assert.equal(retry.alreadyProcessed,true);
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
 assert.equal(m.getAuditLog().filter(x=>x.type==='payout_requested_mock').length,1);
});
test('reembolso repetido después de la liquidación devuelve respuesta original',()=>{
 const m=make(),o=create(m);
 emit(m,o,'funding_settled_mock','fund-refund');
 const requestId='refund-retry-123456';
 assert.equal(m.requestMockRefund({orderId:o.orderId,requestId}).status,'refund_pending_mock');
 emit(m,o,'refund_settled_mock','refund-done');
 const retry=m.requestMockRefund({orderId:o.orderId,requestId});
 assert.equal(retry.status,'refund_pending_mock');
 assert.equal(retry.alreadyProcessed,true);
 assert.equal(m.inspectMockOrder(o.orderId).status,'refunded_mock');
 assert.throws(()=>m.requestMockPayout({orderId:o.orderId,requestId:'pay-after-refund-01'}),/prohibida/);
});

test('tras devolución ficticia fallida permite reintento manual idempotente',()=>{
 const m=make(),o=create(m);
 emit(m,o,'funding_settled_mock','fund-retry');
 m.requestMockRefund({orderId:o.orderId,requestId:'refund-start-123456'});
 emit(m,o,'refund_failed_mock','first-failure');
 assert.equal(m.inspectMockOrder(o.orderId).status,'refund_failed_mock');
 const retry=m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-retry-safe-001'});
 assert.equal(retry.status,'refund_pending_mock');
 assert.equal(retry.realMoneyEnabled,false);
 assert.equal(m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-retry-safe-001'}).alreadyProcessed,true);
 assert.throws(()=>m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-retry-safe-002'}),/prohibida/);
 emit(m,o,'refund_settled_mock','second-settled');
 assert.equal(m.inspectMockOrder(o.orderId).status,'refunded_mock');
 assert.equal(m.getAccountingProposals(o.orderId).length,2);
 assert.equal(m.getAuditLog().filter(x=>x.type==='refund_retry_requested_mock').length,1);
 assert.throws(()=>m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-after-settled-001'}),/prohibida/);
});
test('reintento de devolución no puede aplicarse a pago ni a una orden nueva',()=>{
 const m=make(),o=create(m,'NI');
 assert.throws(()=>m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'retry-before-funded-01'}),/prohibida/);
 emit(m,o,'funding_settled_mock','fund-and-pay');
 m.requestMockPayout({orderId:o.orderId,requestId:'payout-pay-before-refund'});
 emit(m,o,'payout_settled_mock','paid-no-refund');
 assert.throws(()=>m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'retry-after-payout-001'}),/prohibida/);
 assert.equal(m.inspectMockOrder(o.orderId).status,'paid_mock');
});
test('fallos repetidos de reembolso siguen bloqueados hasta decisión manual distinta',()=>{
 const m=make(),o=create(m);
 emit(m,o,'funding_settled_mock','fund-multiple');
 m.requestMockRefund({orderId:o.orderId,requestId:'refund-attempt-first'});
 emit(m,o,'refund_failed_mock','fail-1');
 m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-attempt-second'});
 emit(m,o,'refund_failed_mock','fail-2');
 assert.equal(m.inspectMockOrder(o.orderId).status,'refund_failed_mock');
 assert.equal(m.getAccountingProposals(o.orderId).length,1);
 assert.equal(m.getAuditLog().filter(x=>x.type==='refund_failed_mock').length,2);
 const retry=m.retryMockRefundAfterFailure({orderId:o.orderId,requestId:'refund-attempt-third'});
 assert.equal(retry.status,'refund_pending_mock');
 assert.equal(m.getAccountingProposals(o.orderId).length,1);
});
