import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockPaymentLifecycle} from '../src/server/mock-payment-lifecycle.mjs';
import {createMockInternationalTransferGuard} from '../src/server/mock-international-transfer-guard.mjs';
import {createMockInterruptedTransferRecovery,createMockTransferRecoveryJournal} from '../src/server/mock-interrupted-transfer-recovery.mjs';

const T=1800000000000;
const SECRET='only-mock-network-recovery-32-characters';
const make=({onSubmit,onInspect,journal=createMockTransferRecoveryJournal()}={})=>{
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
 const remount=(restoredJournal=journal)=>createMockInterruptedTransferRecovery({
  transport,getSession:()=>identity,clock:()=>T,journal:restoredJournal
 });
 const recovery=remount();
 const intent=(id='test',dest='HN',rec='SIM-HN-RECIP01')=>({
  requestId:'recovery-transfer-'+id+'-1234',
  senderAlias:identity.actorAlias,recipientAlias:rec,destination:dest,
  amountCents:10000,
 });
 return {lifecycle,guard,recovery,remount,journal,calls,intent,
  switchIdentity:x=>{identity=x;}
 };
};

test('recrear la pantalla conserva el bloqueo pendiente mediante registro compartido DEMO',async()=>{
 const x=make({onSubmit:(guard,args)=>{
  guard.submitMockTransfer(args);throw Error('respuesta perdida');
 }});
 const p=x.guard.previewMockTransfer(x.intent('remount-pending'));
 assert.equal((await x.recovery.submitOnce({preview:p})).status,'pending_verification_mock');
 const nuevaPantalla=x.remount();
 assert.equal(nuevaPantalla.inspectLocalPending().requestId,p.requestId);
 await assert.rejects(nuevaPantalla.submitOnce({preview:p}),/pendiente/);
 assert.equal((await nuevaPantalla.inspectWithoutResubmitting()).status,'verified_mock');
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
 assert.equal(nuevaPantalla.inspectLocalPending(),null);
 assert.equal(x.journal.persistentStorageConnected,false);
 assert.equal(x.journal.survivesDeviceRestart,false);
});

test('recrear la pantalla conserva idempotencia de recibo ya verificado',async()=>{
 const x=make(),p=x.guard.previewMockTransfer(x.intent('remount-settled'));
 const first=await x.recovery.submitOnce({preview:p});
 const second=await x.remount().submitOnce({preview:p});
 assert.equal(second.orderId,first.orderId);
 assert.equal(second.alreadyProcessed,true);
 assert.equal(x.calls.submits,1);
});

test('dos instancias simultáneas de pantalla no pueden generar dos órdenes DEMO',async()=>{
 let deliver;
 const x=make({onSubmit:(guard,args)=>new Promise(resolve=>{
  deliver=()=>resolve(guard.submitMockTransfer(args));
 })});
 const first=x.guard.previewMockTransfer(x.intent('same-actor-1'));
 const other=x.guard.previewMockTransfer(x.intent('same-actor-2'));
 const pending=x.recovery.submitOnce({preview:first});
 const afterRemount=x.remount();
 await assert.rejects(afterRemount.submitOnce({preview:other}),/pendiente/);
 assert.equal(x.calls.submits,1);
 deliver();
 assert.equal((await pending).status,'verified_mock');
 assert.equal(x.calls.submits,1);
});

test('si otra pantalla verifica primero, la respuesta tardía no vuelve a dejar pendiente',async()=>{
 let deliver;
 const x=make({onSubmit:(guard,args)=>new Promise(resolve=>{
  const reply=guard.submitMockTransfer(args);
  deliver=()=>resolve(reply);
 })});
 const p=x.guard.previewMockTransfer(x.intent('racing-inspect'));
 const original=x.recovery.submitOnce({preview:p});
 const revisada=await x.remount().inspectWithoutResubmitting();
 assert.equal(revisada.status,'verified_mock');
 deliver();
 const tardia=await original;
 assert.equal(tardia.status,'verified_mock');
 assert.equal(tardia.alreadyProcessed,true);
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
 assert.equal(x.recovery.inspectLocalPending(),null);
});

test('impide conectar un registro compartido que afirme manejar dinero real',()=>{
 const x=make();
 assert.throws(()=>createMockInterruptedTransferRecovery({
  transport:{mode:'mock_only',realMoneyEnabled:false,bankConnected:false,
   submitMockTransfer:async()=>null,inspectMockTransfer:async()=>null},
  getSession:()=>({actorAlias:'SIM-US-SEND001',revision:1}),
  journal:{mode:'live',realMoneyEnabled:true,persistentStorageConnected:true},
 }),/sólo/);
 assert.equal(x.recovery.persistentStorageConnected,false);
});

test('serializar y restaurar una remesa pendiente no provoca otro envío',async()=>{
 const x=make({onSubmit:(guard,args)=>{
  guard.submitMockTransfer(args);throw Error('respuesta perdida');
 }});
 const p=x.guard.previewMockTransfer(x.intent('checkpoint-pending'));
 assert.equal((await x.recovery.submitOnce({preview:p})).status,'pending_verification_mock');
 // Simula una lectura de datos guardados por OTRO componente tras reiniciar.
 const snapshot=JSON.parse(JSON.stringify(x.journal.exportSnapshot()));
 const restored=createMockTransferRecoveryJournal({snapshot});
 const newController=x.remount(restored);
 assert.equal(newController.inspectLocalPending().requestId,p.requestId);
 await assert.rejects(newController.submitOnce({preview:p}),/pendiente/);
 assert.equal((await newController.inspectWithoutResubmitting()).status,'verified_mock');
 assert.equal(x.calls.submits,1);
 assert.equal(x.calls.inspections,1);
 assert.equal(newController.inspectLocalPending(),null);
});

test('restaurar recibo confirmado mantiene idempotencia para la misma cuenta',async()=>{
 const x=make(),p=x.guard.previewMockTransfer(x.intent('checkpoint-confirmed'));
 const first=await x.recovery.submitOnce({preview:p});
 const snapshot=JSON.parse(JSON.stringify(x.journal.exportSnapshot()));
 assert.equal(snapshot.pending.length,0);
 assert.equal(snapshot.resolved.length,1);
 const saved=createMockTransferRecoveryJournal({snapshot});
 const replay=await x.remount(saved).submitOnce({preview:p});
 assert.equal(replay.orderId,first.orderId);
 assert.equal(replay.alreadyProcessed,true);
 assert.equal(x.calls.submits,1);
});

test('restauración mantiene pendientes separados para dos cuentas sintéticas',async()=>{
 const x=make({onSubmit:()=>{throw Error('red no disponible');}});
 const a=x.guard.previewMockTransfer(x.intent('checkpoint-a'));
 await x.recovery.submitOnce({preview:a});
 x.switchIdentity({actorAlias:'SIM-US-SEND002',revision:2});
 const b=x.guard.previewMockTransfer(x.intent('checkpoint-b'));
 await x.recovery.submitOnce({preview:b});
 const snapshot=JSON.parse(JSON.stringify(x.journal.exportSnapshot()));
 assert.equal(snapshot.pending.length,2);
 const restored=createMockTransferRecoveryJournal({snapshot});
 const controller=x.remount(restored);
 assert.equal(controller.inspectLocalPending().requestId,b.requestId);
 x.switchIdentity({actorAlias:'SIM-US-SEND001',revision:3});
 assert.equal(controller.inspectLocalPending().requestId,a.requestId);
 assert.equal(x.calls.submits,2);
});

test('checkpoint truncado o alterado bloquea restauración; no se asume vacío',async()=>{
 const x=make({onSubmit:()=>{throw Error('timeout');}});
 const p=x.guard.previewMockTransfer(x.intent('checkpoint-tamper'));
 await x.recovery.submitOnce({preview:p});
 const saved=JSON.parse(JSON.stringify(x.journal.exportSnapshot()));
 assert.throws(()=>createMockTransferRecoveryJournal({snapshot:{...saved,sha256:'0'.repeat(64)}}),/alterado/);
 const altered=JSON.parse(JSON.stringify(saved));
 altered.pending[0].preview.amountCents+=100;
 assert.throws(()=>createMockTransferRecoveryJournal({snapshot:altered}),/alterado/);
 assert.throws(()=>createMockTransferRecoveryJournal({snapshot:{...saved,pending:undefined}}),/inválido/);
 assert.equal(x.journal.persistentStorageConnected,false);
 assert.equal(x.journal.survivesDeviceRestart,false);
});

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
