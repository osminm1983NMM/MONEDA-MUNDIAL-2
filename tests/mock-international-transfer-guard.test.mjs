import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {createMockInternationalTransferGuard} from '../src/server/mock-international-transfer-guard.mjs';

let time=1800000000000;
const secret='mock-only-not-real-abcdef0123456789abcd';
const build=()=>{
 const lifecycle=createMockPaymentLifecycle({webhookSecret:secret,clock:()=>time});
 const guard=createMockInternationalTransferGuard({lifecycle,clock:()=>time});
 return {lifecycle,guard};
};
const intent=(id,recipientAlias='SIM-HN-RECIP01',dest='HN')=>({
 requestId:'remittance-intent-'+id+'-0001',
 senderAlias:'SIM-US-SEND001',recipientAlias,destination:dest,amountCents:10000,
});
const prepareAndSubmit=(guard,i,acknowledgeDistinctDuplicate=false)=>{
 const p=guard.previewMockTransfer(i);
 return guard.submitMockTransfer({
  requestId:i.requestId,preflightId:p.preflightId,acknowledgeDistinctDuplicate,
 });
};

test('Honduras: dos etapas y recibo de orden exclusivamente ficticia',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build(),i=intent('hn');
 assert.equal(guard.inspectMockTransfer(i.requestId),null);
 const p=guard.previewMockTransfer(i);
 assert.equal(p.duplicateRiskDetected,false);
 assert.equal(p.beneficiaryIdentityVerified,false);
 assert.equal(lifecycle.getAuditLog().length,0);
 const created=guard.submitMockTransfer({requestId:i.requestId,preflightId:p.preflightId});
 assert.equal(created.status,'created_mock');
 assert.equal(created.realMoneyEnabled,false);
 assert.equal(created.fundingRealConfirmed,false);
 assert.equal(created.payoutRealConfirmed,false);
 assert.equal(created.canMoveRealMoney,false);
 assert.equal(created.destination,'HN');
 assert.equal(lifecycle.getAuditLog().length,1);
 assert.equal(guard.inspectMockTransfer(i.requestId).orderId,created.orderId);
});

test('idempotencia no crea segunda orden aunque se repita la confirmación',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build(),i=intent('repeat'),p=guard.previewMockTransfer(i);
 const first=guard.submitMockTransfer({requestId:i.requestId,preflightId:p.preflightId});
 const second=guard.submitMockTransfer({requestId:i.requestId,preflightId:p.preflightId});
 assert.equal(second.alreadyProcessed,true);
 assert.equal(second.orderId,first.orderId);
 assert.equal(guard.previewMockTransfer(i).status,'already_submitted_mock');
 assert.equal(lifecycle.getAuditLog().filter(e=>e.type==='order_created_mock').length,1);
 assert.throws(()=>guard.submitMockTransfer({
  requestId:i.requestId,preflightId:'123e4567-e89b-42d3-a456-426614174000',
 }),/no corresponde/);
});

test('Nicaragua: país del beneficiario debe coincidir; sin excluir otros mercados',()=>{
 time=1800000000000;
 const {guard}=build(),ni=intent('nicaragua','SIM-NI-RECIP02','NI');
 assert.equal(prepareAndSubmit(guard,ni).destination,'NI');
 assert.throws(()=>guard.previewMockTransfer(intent('mismatch','SIM-HN-RECIP01','NI')),/inválido/);
 assert.throws(()=>guard.previewMockTransfer({
  ...intent('same-country'),senderAlias:'SIM-HN-SEND001'
 }),/inválido/);
 assert.throws(()=>guard.previewMockTransfer({
  ...intent('has-pii'),email:'person@example.org'
 }),/identificadores sintéticos/);
 assert.throws(()=>guard.previewMockTransfer({
  ...intent('notint'),amountCents:99.5
 }),/inválido/);
});

test('intento similar se bloquea antes de crear orden salvo confirmación distinta',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build();
 const a=intent('first'),b=intent('second');
 const first=prepareAndSubmit(guard,a);
 const p=guard.previewMockTransfer(b);
 assert.equal(p.duplicateRiskDetected,true);
 assert.equal(p.priorMockOrderId,first.orderId);
 assert.equal(p.requiresExplicitDistinctConfirmation,true);
 assert.throws(()=>guard.submitMockTransfer({requestId:b.requestId,preflightId:p.preflightId}),
  /Posible transferencia duplicada/);
 assert.equal(lifecycle.getAuditLog().filter(e=>e.type==='order_created_mock').length,1);
 const second=guard.submitMockTransfer({
  requestId:b.requestId,preflightId:p.preflightId,acknowledgeDistinctDuplicate:true,
 });
 assert.equal(second.distinctDuplicateAcknowledged,true);
 assert.notEqual(second.orderId,first.orderId);
 assert.equal(lifecycle.getAuditLog().filter(e=>e.type==='order_created_mock').length,2);
});

test('previsualización obsoleta no sirve tras una nueva orden similar',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build(),a=intent('a'),b=intent('b');
 const early=guard.previewMockTransfer(b);
 prepareAndSubmit(guard,a);
 assert.throws(()=>guard.submitMockTransfer({
  requestId:b.requestId,preflightId:early.preflightId,acknowledgeDistinctDuplicate:true,
 }),/volver a revisar/);
 assert.equal(lifecycle.getAuditLog().length,1);
 const fresh=guard.previewMockTransfer(b);
 assert.notEqual(fresh.preflightId,early.preflightId);
 assert.equal(fresh.duplicateRiskDetected,true);
 assert.throws(()=>guard.submitMockTransfer({
  requestId:b.requestId,preflightId:early.preflightId,
 }),/reemplazada/);
 assert.equal(guard.submitMockTransfer({
  requestId:b.requestId,preflightId:fresh.preflightId,acknowledgeDistinctDuplicate:true,
 }).status,'created_mock');
});

test('misma requestId no puede cambiar beneficiario, importe o país',()=>{
 time=1800000000000;
 const {guard}=build(),a=intent('locked');
 guard.previewMockTransfer(a);
 for(const different of [
  {...a,recipientAlias:'SIM-HN-RECIP09'},
  {...a,amountCents:20000},
  {...a,recipientAlias:'SIM-NI-RECIP09',destination:'NI'},
 ])assert.throws(()=>guard.previewMockTransfer(different),/intención diferente/);
 prepareAndSubmit(guard,a);
 assert.throws(()=>guard.previewMockTransfer({
  ...a,amountCents:99999
 }),/destinatario o importe distinto/);
});

test('confirmar con consentimiento no solicitado falla cerrado',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build(),i=intent('unsafe');
 const p=guard.previewMockTransfer(i);
 assert.throws(()=>guard.submitMockTransfer({
  requestId:i.requestId,preflightId:p.preflightId,acknowledgeDistinctDuplicate:true,
 }),/no corresponde/);
 assert.equal(lifecycle.getAuditLog().length,0);
});

test('caducidad de previsualización y ventana de 10 minutos',()=>{
 time=1800000000000;
 const {guard,lifecycle}=build(),a=intent('window-a'),b=intent('window-b'),c=intent('window-c');
 const p=guard.previewMockTransfer(a);
 time+=120000;
 assert.throws(()=>guard.submitMockTransfer({
  requestId:a.requestId,preflightId:p.preflightId,
 }),/vencida/);
 assert.equal(lifecycle.getAuditLog().length,0);
 const first=prepareAndSubmit(guard,a);
 time+=600001;
 const after=guard.previewMockTransfer(b);
 assert.equal(after.duplicateRiskDetected,false);
 const again=guard.submitMockTransfer({requestId:b.requestId,preflightId:after.preflightId});
 assert.notEqual(first.orderId,again.orderId);
 // Después de la nueva operación hay una advertencia nueva.
 assert.equal(guard.previewMockTransfer(c).duplicateRiskDetected,true);
});

test('el bloqueo sólo depende de la misma combinación remitente/beneficiario/monto/destino',()=>{
 time=1800000000000;
 const {guard}=build(),a=intent('unique-a');
 prepareAndSubmit(guard,a);
 assert.equal(guard.previewMockTransfer({
  ...intent('unique-b'),recipientAlias:'SIM-HN-RECIP99'
 }).duplicateRiskDetected,false);
 assert.equal(guard.previewMockTransfer({
  ...intent('unique-c'),amountCents:12000
 }).duplicateRiskDetected,false);
 assert.equal(guard.previewMockTransfer(
  intent('unique-d','SIM-NI-RECIP01','NI')
 ).duplicateRiskDetected,false);
});

test('rechaza motores ajenos, reloj inválido y datos bancarios en entrada',()=>{
 assert.throws(()=>createMockInternationalTransferGuard({lifecycle:{
  mode:'live',canMoveRealMoney:true
 }}),/ficticias/);
 time=1800000000000;
 const {guard}=build();
 assert.throws(()=>guard.previewMockTransfer({
  ...intent('bank'),bankAccount:'00000123'
 }),/identificadores sintéticos/);
 time=-3;
 assert.throws(()=>guard.previewMockTransfer(intent('time')),/Reloj/);
});
