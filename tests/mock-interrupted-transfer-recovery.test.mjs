import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {createMockInternationalTransferGuard} from '../src/server/mock-international-transfer-guard.mjs';
import {createMockInterruptedTransferRecovery} from '../src/server/mock-interrupted-transfer-recovery.mjs';

const T=1800000000000;
const SECRET='only-mock-network-recovery-32-characters';
const make=({onSubmit,onInspect}={})=>{
 const lifecycle=createMockPaymentLifecycle({webhookSecret:SECRET,clock:()=>T});
 const guard=createMockInternationalTransferGuard({lifecycle,clock:()=>T});
 let identity={actorAlias:'SIM-US-SEND001',revision:1};
 const calls={submits:0,inspections:0};
 const transport={
  mode:'mock_only',realMoneyEnabled:false,bankConnected:false,
  async submitMockTransfer(args){
   calls.submits++;
   if(onSubmit)return onSubmit(guard,args);
   return guard.submitMockTransfer(args);
  },
  async inspectMockTransfer(requestId){
   calls.inspections++;
   if(onInspect)return onInspect(guard,requestId);
   return guard.inspectMockTransfer(requestId);
  }
 };
 const recovery=createMockInterruptedTransferRecovery({
  transport,getSession:()=>identity,clock:()=>T
 });
 const intent=(id='test',dest='HN',rec='SIM-HN-RECIP01')=>({
  requestId:'recovery-transfer-'+id+'-1234',
  senderAlias:identity.actorAlias,recipientAlias:rec,destination:dest,
  amountCents:10000,
 });
 return {lifecycle,guard,recovery,calls,intent,
  switchIdentity:x=>{identity=x;}
 };
};

test('éxito con recibo validado borra pendiente, sin pagos ni retiros reales',async()=>{
 const x=make(),preview=x.guard.previewMockTransfer(x.intent('safe'));
 const result=await x.recovery.submitOnce({preview});
 assert.equal(result.status,'verified_mock');
 assert.equal(result.realMoneyEnabled,false);
 assert.equal(result.payoutRealConfirmed,false);
 assert.equal(result.beneficiaryIdentityVerified,false);
 assert.equal(x.recovery.inspectLocalPending(),null);
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,0);
 assert.equal(x.lifecycle.inspectMockOrder(result.orderId).status,'created_mock');
});

test('si se pierde respuesta DESPUÉS de crear la orden, recuperar SÓLO mediante lectura',async()=>{
 const x=make({onSubmit:(guard,args)=>{
  guard.submitMockTransfer(args);
  throw Error('respuesta de red perdida');
 }});
 const p=x.guard.previewMockTransfer(x.intent('lost-reply'));
 const uncertain=await x.recovery.submitOnce({preview:p});
 assert.equal(uncertain.status,'pending_verification_mock');
 assert.equal(uncertain.safeToSubmitAgain,false);
 assert.equal(x.lifecycle.getAuditLog().length,1);
 await assert.rejects(x.recovery.submitOnce({preview:p}),/pendiente/);
 const checked=await x.recovery.inspectWithoutResubmitting();
 assert.equal(checked.status,'verified_mock');
 assert.equal(x.recovery.inspectLocalPending(),null);
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
 assert.equal(x.lifecycle.getAuditLog().filter(e=>e.type==='order_created_mock').length,1);
 // Tras la recuperación, reutilizar la intención no invoca otra confirmación.
 const replay=await x.recovery.submitOnce({preview:p});
 assert.equal(replay.alreadyProcessed,true);
 assert.equal(x.calls.submits,1);
});

test('si falla conexión ANTES del servidor: ausencia de recibo no autoriza reenvío',async()=>{
 const x=make({onSubmit:()=>{throw Error('sin conexión');}});
 const p=x.guard.previewMockTransfer(x.intent('offline'));
 assert.equal((await x.recovery.submitOnce({preview:p})).status,'pending_verification_mock');
 assert.equal((await x.recovery.inspectWithoutResubmitting()).status,'not_observed_mock');
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
 assert.equal(x.lifecycle.getAuditLog().length,0);
 assert.equal(x.recovery.inspectLocalPending().safeToSubmitAgain,false);
});

test('fallo de inspección mantiene bloqueo y no emite segunda orden',async()=>{
 const x=make({
  onSubmit:(guard,args)=>{guard.submitMockTransfer(args);throw Error('timeout');},
  onInspect:()=>{throw Error('network');}
 });
 const p=x.guard.previewMockTransfer(x.intent('retry-network'));
 await x.recovery.submitOnce({preview:p});
 const r=await x.recovery.inspectWithoutResubmitting();
 assert.equal(r.status,'connection_unverified_mock');
 assert.equal(x.recovery.inspectLocalPending().status,'pending_verification_mock');
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
});

test('respuesta inconsistente jamás desbloquea ni confirma una remesa',async()=>{
 const x=make({
  onSubmit:(guard,args)=>{guard.submitMockTransfer(args);throw Error('timeout');},
  onInspect:(guard,id)=>({...guard.inspectMockTransfer(id),amountCents:2})
 });
 const p=x.guard.previewMockTransfer(x.intent('invalid-reply'));
 await x.recovery.submitOnce({preview:p});
 assert.equal((await x.recovery.inspectWithoutResubmitting()).status,'inconsistent_response_mock');
 assert.ok(x.recovery.inspectLocalPending());
 assert.equal(x.calls.submits,1);
});

test('cambio de cuenta durante respuesta tardía mantiene pendiente de A y oculta todo a B',async()=>{
 let deliver;
 const x=make({onSubmit:(guard,args)=>new Promise(resolve=>{
  const reply=guard.submitMockTransfer(args); deliver=()=>resolve(reply);
 })});
 const p=x.guard.previewMockTransfer(x.intent('account-change'));
 const future=x.recovery.submitOnce({preview:p});
 x.switchIdentity({actorAlias:'SIM-US-SEND002',revision:2});
 assert.equal(x.recovery.inspectLocalPending(),null);
 deliver();
 await assert.rejects(future,/sesión de prueba cambió/);
 assert.equal(x.recovery.inspectLocalPending(),null);
 x.switchIdentity({actorAlias:'SIM-US-SEND001',revision:3});
 assert.equal(x.recovery.inspectLocalPending().requestId,p.requestId);
 const result=await x.recovery.inspectWithoutResubmitting();
 assert.equal(result.status,'verified_mock');
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
});

test('cambio de sesión durante consulta no permite limpiar datos de una cuenta nueva',async()=>{
 let deliver;
 const x=make({
  onSubmit:(guard,args)=>{guard.submitMockTransfer(args);throw Error('lost');},
  onInspect:(guard,id)=>new Promise(resolve=>{deliver=()=>resolve(guard.inspectMockTransfer(id))})
 });
 const p=x.guard.previewMockTransfer(x.intent('late-inspection'));
 await x.recovery.submitOnce({preview:p});
 const future=x.recovery.inspectWithoutResubmitting();
 x.switchIdentity({actorAlias:'SIM-US-SEND002',revision:2});
 deliver();
 await assert.rejects(future,/sesión de prueba cambió/);
 assert.equal(x.recovery.inspectLocalPending(),null);
 x.switchIdentity({actorAlias:'SIM-US-SEND001',revision:3});
 assert.equal(x.recovery.inspectLocalPending().requestId,p.requestId);
});

test('dos operaciones de una misma cuenta no pueden confirmarse simultáneamente',async()=>{
 let deliver;
 const x=make({onSubmit:(guard,args)=>new Promise(resolve=>{
  deliver=()=>resolve(guard.submitMockTransfer(args))
 })});
 const p=x.guard.previewMockTransfer(x.intent('one'));
 const q=x.guard.previewMockTransfer(x.intent('two'));
 const started=x.recovery.submitOnce({preview:p});
 await assert.rejects(x.recovery.submitOnce({preview:q}),/pendiente/);
 deliver();
 assert.equal((await started).status,'verified_mock');
 assert.equal(x.calls.submits,1);
});

test('Honduras y Nicaragua en prueba: destino correcto, ninguna cobertura bancaria implícita',async()=>{
 const x=make();
 const hn=x.guard.previewMockTransfer(x.intent('hn','HN','SIM-HN-RECIP01'));
 const h=await x.recovery.submitOnce({preview:hn});
 const ni=x.guard.previewMockTransfer(x.intent('ni','NI','SIM-NI-RECIP01'));
 const n=await x.recovery.submitOnce({preview:ni});
 assert.equal(h.destination,'HN');
 assert.equal(n.destination,'NI');
 assert.equal(x.calls.submits,2);
 assert.equal(n.realMoneyEnabled,false);
});

test('rechaza sesión ficticia inválida, cotización adulterada y consentimiento incorrecto',async()=>{
 const x=make(),preview=x.guard.previewMockTransfer(x.intent('validate'));
 await assert.rejects(x.recovery.submitOnce({preview:{
  ...preview,realMoneyEnabled:true
 }}),/inválida/);
 await assert.rejects(x.recovery.submitOnce({preview,
  acknowledgeDistinctDuplicate:true}),/confirmación explícita/);
 assert.equal(x.calls.submits,0);
 x.switchIdentity({actorAlias:'SIM-US-SEND002',revision:9});
 await assert.rejects(x.recovery.submitOnce({preview}),/inválida/);
 assert.equal(x.recovery.inspectLocalPending(),null);
 assert.throws(()=>createMockInterruptedTransferRecovery({transport:{
  mode:'live',realMoneyEnabled:true
 },getSession:()=>({actorAlias:'SIM-US-SEND001',revision:1})}),/sólo/);
});
