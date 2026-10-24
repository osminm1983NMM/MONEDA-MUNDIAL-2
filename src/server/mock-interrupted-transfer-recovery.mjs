// Moneda Mundial 2.0: recuperación de remesas interrumpidas, SOLO LABORATORIO.
// Controlador volátil, sin API bancaria, autenticación real, almacenamiento ni dinero.
// Si una confirmación da resultado incierto, NUNCA se vuelve a ejecutar el envío:
// se consulta únicamente inspectMockTransfer con la misma referencia.
const ALIAS=/^SIM-([A-Z]{2})-[A-Z0-9]{3,12}$/;
const REQUEST=/^[A-Za-z0-9_-]{12,90}$/;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const frozen=o=>Object.freeze(o);
const fail=m=>{throw new Error(m)};

function verifyPreview(p,actor,t){
 if(!p||typeof p!=='object'||Array.isArray(p)||
    p.status!=='preview_mock'||typeof p.preflightId!=='string'||
    !UUID.test(p.preflightId)||!REQUEST.test(p.requestId||'')||
    p.senderAlias!==actor||!ALIAS.test(p.recipientAlias||'')||
    typeof p.destination!=='string'||p.recipientAlias.slice(4,6)!==p.destination||
    !Number.isSafeInteger(p.amountCents)||p.amountCents<100||p.amountCents>10000000||
    !Number.isSafeInteger(p.expiresAtMs)||p.expiresAtMs<=t||
    typeof p.duplicateRiskDetected!=='boolean'||
    p.requiresExplicitDistinctConfirmation!==p.duplicateRiskDetected||
    p.beneficiaryIdentityVerified!==false||
    p.realMoneyEnabled!==false||p.transferExecuted!==false||
    p.canMoveRealMoney!==false)
  fail('Vista previa de transferencia DEMO inválida u obsoleta');
 return frozen({
  requestId:p.requestId,preflightId:p.preflightId,senderAlias:actor,
  recipientAlias:p.recipientAlias,destination:p.destination,
  amountCents:p.amountCents,expiresAtMs:p.expiresAtMs,
  duplicateRiskDetected:p.duplicateRiskDetected
 });
}
const fingerprint=p=>JSON.stringify([
 p.senderAlias,p.recipientAlias,p.destination,p.amountCents,p.preflightId
]);
function verifyReceipt(r,p){
 return Boolean(r&&typeof r==='object'&&!Array.isArray(r)&&
  r.status==='created_mock'||false) &&
  typeof r.orderId==='string'&&UUID.test(r.orderId)&&
  r.requestId===p.requestId&&r.preflightId===p.preflightId&&
  r.senderAlias===p.senderAlias&&r.recipientAlias===p.recipientAlias&&
  r.destination===p.destination&&r.amountCents===p.amountCents&&
  r.realMoneyEnabled===false&&r.canMoveRealMoney===false&&
  r.fundingRealConfirmed===false&&r.payoutRealConfirmed===false&&
  r.beneficiaryIdentityVerified===false;
}

// Registro compartido VOLÁTIL para reconstruir una pantalla sin reenviar.
// No usa AsyncStorage, servidores ni disco: NO protege frente a reinicio real.
export function createMockTransferRecoveryJournal(){
 const pending=new Map(),resolved=new Map();
 const actorOk=actor=>{
  if(typeof actor!=='string'||!ALIAS.test(actor))fail('Cuenta sintética inválida');
 };
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,persistentStorageConnected:false,
  survivesDeviceRestart:false,
  pendingFor(actor){actorOk(actor);return pending.get(actor)||null;},
  resolvedFor(actor,requestId){
   actorOk(actor);
   if(!REQUEST.test(requestId||''))fail('Referencia ficticia inválida');
   return resolved.get(actor)?.get(requestId)||null;
  },
  beginPending(actor,record){
   actorOk(actor);
   if(!record||!record.preview||record.preview.senderAlias!==actor||
      !REQUEST.test(record.preview.requestId||'')||
      record.acknowledgeDistinctDuplicate!==record.preview.duplicateRiskDetected)
    fail('Registro pendiente de prueba inválido');
   if(pending.has(actor))fail('Hay una remesa pendiente: no reenviar');
   pending.set(actor,frozen(record));
  },
  completePending(actor,requestId,record){
   actorOk(actor);
   const item=pending.get(actor);
   if(!item||item.preview.requestId!==requestId||
      !record||record.fingerprint!==fingerprint(item.preview)||
      !verifyReceipt(record.receipt,item.preview))
    fail('No se puede liberar una remesa pendiente no verificada');
   if(!resolved.has(actor))resolved.set(actor,new Map());
   const prior=resolved.get(actor).get(requestId);
   if(prior&&prior.fingerprint!==record.fingerprint)
    fail('Referencia ya asociada con una remesa distinta');
   resolved.get(actor).set(requestId,frozen({
    fingerprint:record.fingerprint,
    preview:item.preview,
    receipt:frozen({...record.receipt})
   }));
   pending.delete(actor);
  },
 });
}

export function createMockInterruptedTransferRecovery({
 transport,getSession,clock=()=>Date.now(),journal=createMockTransferRecoveryJournal()
}={}){
 if(transport?.mode!=='mock_only'||transport?.realMoneyEnabled!==false||
    transport?.bankConnected!==false||
    typeof transport.submitMockTransfer!=='function'||
    typeof transport.inspectMockTransfer!=='function'||
    typeof getSession!=='function'||typeof clock!=='function'||
    journal?.mode!=='mock_only'||journal?.realMoneyEnabled!==false||
    journal?.persistentStorageConnected!==false||
    typeof journal.pendingFor!=='function'||
    typeof journal.resolvedFor!=='function'||
    typeof journal.beginPending!=='function'||
    typeof journal.completePending!=='function')
  fail('Controlador disponible sólo para conexiones DEMO');
 function session(){
  const x=getSession();
  if(!x||typeof x!=='object'||!ALIAS.test(x.actorAlias||'')||
     !Number.isSafeInteger(x.revision)||x.revision<0)
   fail('Contexto de cuenta sintética inválido');
  return frozen({actorAlias:x.actorAlias,revision:x.revision});
 }
 function assertCurrent(s){
  const current=session();
  if(current.actorAlias!==s.actorAlias||current.revision!==s.revision)
   fail('La sesión de prueba cambió; conservar operación pendiente');
 }
 function now(){
  const t=clock();
  if(!Number.isSafeInteger(t)||t<0)fail('Reloj ficticio inválido');
  return t;
 }
 function safePending(p){
  return frozen({
   status:'pending_verification_mock',requestId:p.requestId,
   preflightId:p.preflightId,destination:p.destination,amountCents:p.amountCents,
   recipientAlias:p.recipientAlias,mayHaveCreatedMockOrder:true,
   safeToSubmitAgain:false,realMoneyEnabled:false,canMoveRealMoney:false
  });
 }
 function safeVerified(p,receipt,alreadyProcessed=false){
  return frozen({
   status:'verified_mock',requestId:p.requestId,orderId:receipt.orderId,
   recipientAlias:p.recipientAlias,destination:p.destination,
   amountCents:p.amountCents,alreadyProcessed,
   beneficiaryIdentityVerified:false,fundingRealConfirmed:false,
   payoutRealConfirmed:false,realMoneyEnabled:false,canMoveRealMoney:false
  });
 }
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,persistentStorageConnected:false,
  customerIdentityVerified:false,
  inspectLocalPending(){
   const s=session(),p=journal.pendingFor(s.actorAlias);
   return p?safePending(p.preview):null;
  },
  // Esta función es la ÚNICA vía que confirma el ejemplo remoto.
  // Se registra PENDIENTE ANTES de llamar a la red.
  async submitOnce({preview,acknowledgeDistinctDuplicate=false}={}){
   const s=session(),p=verifyPreview(preview,s.actorAlias,now());
   if(typeof acknowledgeDistinctDuplicate!=='boolean'||
      acknowledgeDistinctDuplicate!==p.duplicateRiskDetected)
    fail('La confirmación explícita de duplicación no corresponde');
   const current=journal.pendingFor(s.actorAlias);
   if(current)
    fail('Hay una remesa pendiente: verificar sólo en lectura, no reenviar');
   const resolved=journal.resolvedFor(s.actorAlias,p.requestId);
   if(resolved){
    if(resolved.fingerprint!==fingerprint(p))
     fail('Referencia reutilizada para otra remesa ficticia');
    return safeVerified(resolved.preview,resolved.receipt,true);
   }
   const pending=frozen({preview:p,acknowledgeDistinctDuplicate});
   // Se bloquea un segundo envío ANTES de invocar el servicio ficticio.
   journal.beginPending(s.actorAlias,pending);
   try{
    const reply=await transport.submitMockTransfer({
     requestId:p.requestId,preflightId:p.preflightId,
     acknowledgeDistinctDuplicate
    });
    assertCurrent(s);
    if(!verifyReceipt(reply,p))
     fail('Respuesta no verificable, se conserva referencia pendiente');
    journal.completePending(s.actorAlias,p.requestId,frozen({
     fingerprint:fingerprint(p),preview:p,receipt:frozen({...reply})
    }));
    return safeVerified(p,reply);
   }catch(err){
    // Un timeout puede ocurrir DESPUÉS del commit remoto: nunca reintentar submit.
    assertCurrent(s);
    // Otra pantalla pudo confirmar en lectura mientras este request esperaba.
    const verified=journal.resolvedFor(s.actorAlias,p.requestId);
    if(verified){
     if(verified.fingerprint!==fingerprint(p))
      fail('Referencia reutilizada para otra remesa ficticia');
     return safeVerified(verified.preview,verified.receipt,true);
    }
    return safePending(p);
   }
  },
  // Solamente LECTURA, incluso si inspect devuelve null o falla la conexión.
  async inspectWithoutResubmitting(){
   const s=session(),pending=journal.pendingFor(s.actorAlias);
   if(!pending)return null;
   const p=pending.preview;
   let reply;
   try{
    reply=await transport.inspectMockTransfer(p.requestId);
    assertCurrent(s);
   }catch(err){
    assertCurrent(s);
    return frozen({...safePending(p),status:'connection_unverified_mock'});
   }
   if(reply===null)
    return frozen({...safePending(p),status:'not_observed_mock'});
   if(!verifyReceipt(reply,p))
    return frozen({...safePending(p),status:'inconsistent_response_mock'});
   try{
    journal.completePending(s.actorAlias,p.requestId,frozen({
     fingerprint:fingerprint(p),preview:p,receipt:frozen({...reply})
    }));
   }catch(err){
    const prior=journal.resolvedFor(s.actorAlias,p.requestId);
    if(prior?.fingerprint===fingerprint(p))
     return safeVerified(prior.preview,prior.receipt,true);
    return frozen({...safePending(p),status:'inconsistent_response_mock'});
   }
   return safeVerified(p,reply);
  },
 });
}
