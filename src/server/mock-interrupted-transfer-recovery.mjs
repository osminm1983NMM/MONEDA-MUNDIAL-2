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

export function createMockInterruptedTransferRecovery({
 transport,getSession,clock=()=>Date.now()
}={}){
 if(transport?.mode!=='mock_only'||transport?.realMoneyEnabled!==false||
    transport?.bankConnected!==false||
    typeof transport.submitMockTransfer!=='function'||
    typeof transport.inspectMockTransfer!=='function'||
    typeof getSession!=='function'||typeof clock!=='function')
  fail('Controlador disponible sólo para conexiones DEMO');
 const pendingByActor=new Map(),resolvedByActor=new Map();
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
   const s=session(),p=pendingByActor.get(s.actorAlias);
   return p?safePending(p.preview):null;
  },
  // Esta función es la ÚNICA vía que confirma el ejemplo remoto.
  // Se registra PENDIENTE ANTES de llamar a la red.
  async submitOnce({preview,acknowledgeDistinctDuplicate=false}={}){
   const s=session(),p=verifyPreview(preview,s.actorAlias,now());
   if(typeof acknowledgeDistinctDuplicate!=='boolean'||
      acknowledgeDistinctDuplicate!==p.duplicateRiskDetected)
    fail('La confirmación explícita de duplicación no corresponde');
   const current=pendingByActor.get(s.actorAlias);
   if(current)
    fail('Hay una remesa pendiente: verificar sólo en lectura, no reenviar');
   const resolved=resolvedByActor.get(s.actorAlias)?.get(p.requestId);
   if(resolved){
    if(resolved.fingerprint!==fingerprint(p))
     fail('Referencia reutilizada para otra remesa ficticia');
    return safeVerified(resolved.preview,resolved.receipt,true);
   }
   const pending=frozen({preview:p,acknowledgeDistinctDuplicate});
   pendingByActor.set(s.actorAlias,pending);
   try{
    const reply=await transport.submitMockTransfer({
     requestId:p.requestId,preflightId:p.preflightId,
     acknowledgeDistinctDuplicate
    });
    assertCurrent(s);
    if(!verifyReceipt(reply,p))
     fail('Respuesta no verificable, se conserva referencia pendiente');
    if(!resolvedByActor.has(s.actorAlias))
     resolvedByActor.set(s.actorAlias,new Map());
    resolvedByActor.get(s.actorAlias).set(p.requestId,frozen({
     fingerprint:fingerprint(p),preview:p,receipt:frozen({...reply})
    }));
    pendingByActor.delete(s.actorAlias);
    return safeVerified(p,reply);
   }catch(err){
    // Un timeout puede ocurrir DESPUÉS del commit remoto: nunca reintentar submit.
    assertCurrent(s);
    return safePending(p);
   }
  },
  // Solamente LECTURA, incluso si inspect devuelve null o falla la conexión.
  async inspectWithoutResubmitting(){
   const s=session(),pending=pendingByActor.get(s.actorAlias);
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
   if(!resolvedByActor.has(s.actorAlias))
    resolvedByActor.set(s.actorAlias,new Map());
   resolvedByActor.get(s.actorAlias).set(p.requestId,frozen({
    fingerprint:fingerprint(p),preview:p,receipt:frozen({...reply})
   }));
   pendingByActor.delete(s.actorAlias);
   return safeVerified(p,reply);
  },
 });
}
