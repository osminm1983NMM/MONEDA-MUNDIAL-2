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

test('reutilizar un id de notificación con otro estado u orden NO se trata como duplicado válido',()=>{
 const m=make();
 const a=m.submitSandboxTransfer({requestId:'request-replay-aaaa01',order});
 const b=m.submitSandboxTransfer({requestId:'request-replay-bbbb01',order:{...order,destination:'NI'}});
 const first=m.makeMockWebhook({id:'event-shared-replay-123',transferId:a.id,status:'sandbox_pending'});
 assert.equal(m.verifyAndApplyWebhook(first).status,'sandbox_pending');
 const otherStatus=m.makeMockWebhook({id:'event-shared-replay-123',transferId:a.id,status:'sandbox_completed'});
 assert.throws(()=>m.verifyAndApplyWebhook(otherStatus),/reutilizado/);
 const otherOrder=m.makeMockWebhook({id:'event-shared-replay-123',transferId:b.id,status:'sandbox_pending'});
 assert.throws(()=>m.verifyAndApplyWebhook(otherOrder),/reutilizado/);
 assert.equal(m.verifyAndApplyWebhook(first).alreadyProcessed,true);
 assert.equal(m.getSandboxTransfer(b.id).status,'sandbox_submitted');
 assert.equal(m.getSanitizedAudit().length,3);
});
test('notificación de laboratorio rechaza campos ajenos aunque estén firmados con clave de TEST',async()=>{
 const m=make(),a=m.submitSandboxTransfer({requestId:'request-field-test-01',order});
 const signed=m.makeMockWebhook({id:'event-valid-test-4444',transferId:a.id,status:'sandbox_pending'});
 const {createHmac}=await import('node:crypto');
 const rawBody=JSON.stringify({...JSON.parse(signed.rawBody),accountNumber:'1234'});
 const signature=createHmac('sha256',secret).update(String(signed.timestamp)+'.'+rawBody).digest('hex');
 assert.throws(()=>m.verifyAndApplyWebhook({rawBody,timestamp:signed.timestamp,signature}),/Esquema/);
 assert.equal(m.getSandboxTransfer(a.id).status,'sandbox_submitted');
});

test('contrato estricto del puente no ignora campos personales ni autorizaciones declaradas',()=>{
 const m=make();
 for(const candidate of [
  {...order,beneficiaryEmail:'someone@example.com'},
  {...order,bankAccount:'123456'},
  {...order,ssn:'000-00-0000'},
  {...order,liveApproved:true},
  {...order,providerToken:'fake-token'},
  {...order,recipientFullName:'TEST PERSON'},
 ]){
  assert.throws(()=>m.quote(candidate),/inválida/);
  assert.throws(()=>m.submitSandboxTransfer({requestId:'request-extra-fields-123',order:candidate}),/inválida/);
 }
 const inherited=Object.create(order);
 assert.throws(()=>m.quote(inherited),/inválida/);
 assert.throws(()=>createMockRegulatedProviderBridge({webhookSecret:secret,liveFundsEnabled:true}),/Configuración/);
 assert.throws(()=>createMockRegulatedProviderBridge({webhookSecret:secret,providerApiKey:'secret'}),/Configuración/);
 assert.equal(m.moneyMovementEnabled,false);
 assert.equal(m.getSanitizedAudit().length,0);
});
test('marcas de tiempo inválidas nunca pasan una firma válida aunque reloj falle',()=>{
 const signedClock=1700000000000;
 const good=make(),transfer=good.submitSandboxTransfer({requestId:'request-invalid-clock-01',order});
 const signed=good.makeMockWebhook({id:'event-invalid-clock-01',transferId:transfer.id,status:'sandbox_pending'});
 for(const clock of [()=>Number.NaN,()=>Number.POSITIVE_INFINITY,()=>undefined,()=>-1,()=>0.1]){
  const broken=createMockRegulatedProviderBridge({webhookSecret:secret,clock});
  assert.throws(()=>broken.verifyAndApplyWebhook(signed),/vencida/);
  assert.throws(()=>broken.makeMockWebhook({transferId:transfer.id,status:'sandbox_pending'}),/Reloj/);
 }
 const boundary=createMockRegulatedProviderBridge({webhookSecret:secret,clock:()=>signedClock+5*60*1000});
 const another=boundary.submitSandboxTransfer({requestId:'request-boundary-clock-01',order});
 const signature=good.makeMockWebhook({id:'event-boundary-clock-01',transferId:another.id,status:'sandbox_pending'});
 assert.equal(boundary.verifyAndApplyWebhook(signature).status,'sandbox_pending');
 const outdated=createMockRegulatedProviderBridge({webhookSecret:secret,clock:()=>signedClock+5*60*1000+1});
 assert.throws(()=>outdated.verifyAndApplyWebhook(signature),/vencida/);
});
test('catálogo de países de DISEÑO exige códigos únicos sin habilitar remesas reales',()=>{
 assert.throws(()=>createMockRegulatedProviderBridge({webhookSecret:secret,countryCodes:['HN','HN']}),/Catálogo/);
 const m=createMockRegulatedProviderBridge({webhookSecret:secret,countryCodes:['HN','NI','CR','EC']});
 assert.deepEqual(m.supportedDesignRoutes,['US:CR','US:EC','US:HN','US:NI']);
 for(const destination of ['HN','NI','CR','EC']){
  const q=m.quote({...order,destination});
  assert.equal(q.quoteValidForRealTransfer,false);
  assert.equal(q.feeCents,null);
  assert.equal(q.fxRate,null);
  assert.equal(q.recipientAmountCents,null);
  assert.equal(q.redeemable,false);
 }
});

test('reintento idempotente refleja último estado mock sin duplicar remesas ni fingir pago',()=>{
 const m=make();
 const requestId='request-status-retained-001';
 const created=m.submitSandboxTransfer({requestId,order});
 const pending=m.makeMockWebhook({id:'event-status-pending-001',transferId:created.id,status:'sandbox_pending'});
 assert.equal(m.verifyAndApplyWebhook(pending).status,'sandbox_pending');
 const retry=m.submitSandboxTransfer({requestId,order});
 assert.equal(retry.id,created.id);
 assert.equal(retry.alreadyProcessed,true);
 assert.equal(retry.status,'sandbox_pending');
 assert.equal(retry.fundingConfirmed,false);
 assert.equal(retry.recipientPaid,false);
 const completed=m.makeMockWebhook({id:'event-status-complete-001',transferId:created.id,status:'sandbox_completed'});
 assert.equal(m.verifyAndApplyWebhook(completed).status,'sandbox_completed');
 const again=m.submitSandboxTransfer({requestId,order});
 assert.equal(again.status,'sandbox_completed');
 assert.equal(again.id,created.id);
 assert.equal(again.realPaymentsEnabled,false);
 assert.equal(again.redeemable,false);
 assert.equal(m.getSanitizedAudit().filter(x=>x.type==='mock_transfer_created').length,1);
 assert.throws(()=>m.submitSandboxTransfer({requestId,order:{...order,amountCents:10001}}),/reutilizada/);
});
test('envelopes falsificados NO pueden inyectar autorización o datos bancarios',()=>{
 const m=make();
 const envelope={requestId:'request-strict-test-001',order};
 for(const extra of [
   {liveApproved:true},{bankAccount:'test-account'},
   {providerToken:'secret'},{senderName:'test-person'}
 ])assert.throws(()=>m.submitSandboxTransfer({...envelope,...extra}),/inválida/);
 assert.throws(()=>m.submitSandboxTransfer(null),/inválida/);
 const submitted=m.submitSandboxTransfer(envelope);
 const good=m.makeMockWebhook({id:'event-strict-test-001',transferId:submitted.id,status:'sandbox_pending'});
 assert.throws(()=>m.verifyAndApplyWebhook({...good,providerPaid:true}),/inválida/);
 assert.throws(()=>m.verifyAndApplyWebhook({...good,accountNumber:'test'}),/inválida/);
 assert.equal(m.getSandboxTransfer(submitted.id).status,'sandbox_submitted');
 assert.equal(m.verifyAndApplyWebhook(good).status,'sandbox_pending');
 assert.equal(m.getSandboxTransfer(submitted.id).recipientPaid,false);
});
