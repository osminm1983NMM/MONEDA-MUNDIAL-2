import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockRegulatedProviderBridge} from '../src/server/mock-regulated-provider-bridge.mjs';
const secret='this-secret-is-only-for-testing-never-production';
const order={origin:'US',destination:'HN',sourceCurrency:'USD',amountCents:10000,payoutMethod:'cash_pickup'};
const make=()=>createMockRegulatedProviderBridge({webhookSecret:secret,clock:()=>1700000000000});
test('el mock no admite operaciones reales',()=>{
 assert.throws(()=>createMockRegulatedProviderBridge({mode:'live',webhookSecret:secret}),/BLOQUEADO/);
 const m=make(),q=m.quote(order);
 assert.equal(q.feeCents,null);assert.equal(q.quoteValidForRealTransfer,false);
 assert.equal(m.moneyMovementEnabled,false);
 assert.throws(()=>m.submitSandboxTransfer({requestId:'request-long-test',order:{...order,cardNumber:'4111'}}),/prohibidos/);
});
test('doble solicitud no crea dos transferencias; distinto payload falla',()=>{
 const m=make(),a=m.submitSandboxTransfer({requestId:'request-one-123456',order});
 const b=m.submitSandboxTransfer({requestId:'request-one-123456',order});
 assert.equal(a.id,b.id);assert.equal(b.alreadyProcessed,true);
 assert.throws(()=>m.submitSandboxTransfer({requestId:'request-one-123456',order:{...order,amountCents:10001}}),/reutilizada/);
});
test('firma HMAC rechaza alteración, vence, replay e impide saltarse estados',()=>{
 const m=make(),r=m.submitSandboxTransfer({requestId:'request-two-123456',order});
 const early=m.makeMockWebhook({id:'event-early-1234567',transferId:r.id,status:'sandbox_completed'});
 assert.throws(()=>m.verifyAndApplyWebhook(early),/Transición/);
 const event=m.makeMockWebhook({id:'event-test-1234567',transferId:r.id,status:'sandbox_pending'});
 assert.throws(()=>m.verifyAndApplyWebhook({...event,rawBody:event.rawBody+' '}),/Firma/);
 assert.throws(()=>m.verifyAndApplyWebhook({...event,timestamp:event.timestamp-600000}),/vencida/);
 assert.equal(m.verifyAndApplyWebhook(event).status,'sandbox_pending');
 assert.equal(m.verifyAndApplyWebhook(event).alreadyProcessed,true);
 const done=m.makeMockWebhook({id:'event-done-1234567',transferId:r.id,status:'sandbox_completed'});
 assert.equal(m.verifyAndApplyWebhook(done).status,'sandbox_completed');
 assert.throws(()=>m.verifyAndApplyWebhook(m.makeMockWebhook({id:'event-extra-123456',transferId:r.id,status:'sandbox_completed'})),/Transición/);
 assert.equal(m.getSandboxTransfer(r.id).recipientPaid,false);
});

test('Honduras y Nicaragua se conservan como destinos de diseño, nunca rutas reales',()=>{
 const m=make();
 assert.deepEqual(m.supportedDesignRoutes,['US:HN','US:NI']);
 assert.equal(m.priorityDesignRoute,'US:HN');
 const n={...order,destination:'NI'};
 assert.equal(m.quote(n).route,'US:NI');
 assert.equal(m.submitSandboxTransfer({requestId:'request-nicaragua-01',order:n}).realPaymentsEnabled,false);
 assert.throws(()=>m.quote({...order,destination:'CR'}),/Ruta/);
 const all=createMockRegulatedProviderBridge({webhookSecret:secret,countryCodes:['HN','NI','CR']});
 assert.equal(all.quote({...order,destination:'CR'}).redeemable,false);
 assert.equal(all.providerConnected,false);
});
