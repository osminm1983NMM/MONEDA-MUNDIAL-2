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
