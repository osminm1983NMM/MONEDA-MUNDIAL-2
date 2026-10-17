import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockProviderSecurityGateway} from '../src/server/mock-provider-security-gateway.mjs';
const alpha='future_regulated_provider_alpha',beta='future_regulated_provider_beta';
let now=1700000000000;
const secretA='only-testing-active-secret-aaaaaaaaaaaaaaaa',secretB='only-testing-beta-secret-bbbbbbbbbbbbbbbbb';
function make(){now=1700000000000;return createMockProviderSecurityGateway({clock:()=>now,providerSecrets:{
 [alpha]:{activeSecret:secretA,previousSecret:'only-testing-old-secret-xxxxxxxxxxxxxxxx',previousValidUntil:now+10000},
 [beta]:{activeSecret:secretB},
}})}
const payload=(orderId,eventId,status='funding_settled_mock',country='HN')=>
 ({eventId,orderId,status,country,currency:'USD',amountCents:10000});
test('port de seguridad de laboratorio bloquea dinero real y oculta secretos',()=>{
 const g=make();
 assert.equal(g.realFundsEnabled,false);
 assert.equal(g.canCallBankApi,false);
 assert.equal(JSON.stringify(g).includes(secretA),false);
 assert.throws(()=>createMockProviderSecurityGateway({mode:'live',providerSecrets:{[alpha]:{activeSecret:secretA}}}),/BLOQUEADA/);
 assert.throws(()=>createMockProviderSecurityGateway({providerSecrets:{bank_real:{activeSecret:secretA}}}),/no permitido/);
});
test('válida firma HMAC de proveedor, correlación, replay y estados',()=>{
 const g=make(),orderId='mock-order-111111';
 g.registerMockOrder({provider:alpha,orderId,country:'HN',currency:'USD',amountCents:10000});
 const e=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'mock-event-111111')});
 assert.equal(g.receiveSyntheticWebhook(e).stage,'funding_settled_mock');
 assert.equal(g.receiveSyntheticWebhook(e).duplicate,true);
 assert.equal(g.safeAudit().length,1);
 assert.equal(g.inspectMockOrder({provider:alpha,orderId}).canPayout,false);
 const paid=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'mock-event-222222','payout_settled_mock')});
 assert.throws(()=>g.receiveSyntheticWebhook(paid),/fuera de orden/);
 const pending=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'mock-event-333333','payout_pending_mock')});
 g.receiveSyntheticWebhook(pending);
 assert.equal(g.receiveSyntheticWebhook(paid).stage,'payout_settled_mock');
});
test('rechaza alteración, evento ajeno, clave de otro proveedor y timestamp vencido',()=>{
 const g=make(),orderId='mock-order-222222';
 g.registerMockOrder({provider:alpha,orderId,country:'HN',currency:'USD',amountCents:10000});
 const e=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'mock-event-444444')});
 assert.throws(()=>g.receiveSyntheticWebhook({...e,rawBody:e.rawBody+' '}),/Firma/);
 assert.throws(()=>g.receiveSyntheticWebhook({...e,provider:beta}),/Firma/);
 now+=360000;
 assert.throws(()=>g.receiveSyntheticWebhook(e),/vencida/);
 now-=360000;
 assert.throws(()=>g.registerMockOrder({provider:alpha,orderId,country:'HN',currency:'USD',amountCents:10001}),/reutilizada/);
});
test('permite NI como ejemplo sin afirmar autorizaciones para corredores',()=>{
 const g=make(),orderId='mock-order-nicaragua';
 g.registerMockOrder({provider:beta,orderId,country:'NI',currency:'USD',amountCents:10000});
 const e=g.makeSyntheticSignedEvent({provider:beta,payload:payload(orderId,'mock-event-nicaragua','funding_pending_mock','NI')});
 const accepted=g.receiveSyntheticWebhook(e);
 assert.equal(accepted.realFundsEnabled,false);
 assert.equal(accepted.realProviderConnected,false);
 assert.equal(g.safeAudit()[0].source,'mock_test_only');
});

test('reintentar evento anterior devuelve su estado original sin retroceder la orden',()=>{
 const g=make(),orderId='mock-order-replay-stage';
 g.registerMockOrder({provider:alpha,orderId,country:'HN',currency:'USD',amountCents:10000});
 const funding=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'event-replay-funding-123')});
 const pending=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'event-replay-pending-123','payout_pending_mock')});
 const paid=g.makeSyntheticSignedEvent({provider:alpha,payload:payload(orderId,'event-replay-paid-123','payout_settled_mock')});
 assert.equal(g.receiveSyntheticWebhook(funding).stage,'funding_settled_mock');
 assert.equal(g.receiveSyntheticWebhook(pending).stage,'payout_pending_mock');
 assert.equal(g.receiveSyntheticWebhook(paid).stage,'payout_settled_mock');
 const duplicate=g.receiveSyntheticWebhook(funding);
 assert.equal(duplicate.duplicate,true);
 assert.equal(duplicate.stage,'funding_settled_mock');
 assert.equal(g.inspectMockOrder({provider:alpha,orderId}).stage,'payout_settled_mock');
 assert.equal(g.safeAudit().length,3);
 assert.equal(duplicate.realFundsEnabled,false);
});

test('rechaza reutilizar un eventId firmado para otra etapa u orden',()=>{
 const g=make();
 for(const orderId of ['mock-order-replay-one','mock-order-replay-two'])
  g.registerMockOrder({provider:alpha,orderId,country:'HN',currency:'USD',amountCents:10000});
 const first=g.makeSyntheticSignedEvent({provider:alpha,payload:payload('mock-order-replay-one','same-event-id-123456')});
 g.receiveSyntheticWebhook(first);
 for(const change of [
  payload('mock-order-replay-one','same-event-id-123456','funding_pending_mock'),
  payload('mock-order-replay-two','same-event-id-123456')
 ]){
  const reSigned=g.makeSyntheticSignedEvent({provider:alpha,payload:change});
  assert.throws(()=>g.receiveSyntheticWebhook(reSigned),/reutilizado/);
 }
 assert.equal(g.safeAudit().length,1);
});
