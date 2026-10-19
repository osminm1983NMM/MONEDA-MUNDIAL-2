// Moneda Mundial 2.0: referencia local de una operación MWD FICTICIA incierta.
// No guardar contraseñas, sesiones, tarjetas, documentos ni datos bancarios.
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CODE=/^MWD-[A-F0-9]{16}$/;
export function mwdPendingStorageKey(userId){
 return typeof userId==='string'&&UUID.test(userId)
   ? 'moneda-mundial:pending-mwd-demo:v1:'+userId.toLowerCase() : null;
}
export function validateMwdPending(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
    x.version!==1||x.mode!=='sandbox_only'||x.realPaymentsEnabled!==false||
    typeof x.id!=='string'||!UUID.test(x.id)||
    !['transfer','contribution'].includes(x.type)||
    !Number.isSafeInteger(x.cents)||x.cents<1||x.cents>100000000||
    typeof x.code!=='string') return null;
 if(x.type==='transfer'&&!CODE.test(x.code))return null;
 if(x.type==='contribution'&&x.code!=='')return null;
 return {id:x.id,type:x.type,cents:x.cents,code:x.code};
}
export function serializeMwdPending(request){
 const value=validateMwdPending({...request,version:1,mode:'sandbox_only',realPaymentsEnabled:false});
 if(!value)return null;
 return JSON.stringify({...value,version:1,mode:'sandbox_only',realPaymentsEnabled:false});
}
export function deserializeMwdPending(raw){
 if(typeof raw!=='string'||raw.length>1024)return null;
 try{return validateMwdPending(JSON.parse(raw));}catch{return null;}
}

/**
 * Solamente operaciones de PRUEBA. Si hace falta reintentar una confirmación
 * incierta, se repite EXACTAMENTE la referencia y parámetros originales.
 * El servidor exige UNIQUE(actor_id, request_id) e idempotencia por RPC.
 */
export function buildMwdDemoRetry(request){
 if(!request||typeof request!=='object')return null;
 const valid=validateMwdPending({...request,version:1,
   mode:'sandbox_only',realPaymentsEnabled:false});
 if(!valid)return null;
 if(valid.type==='transfer')return {
   rpc:'mwd_transfer_demo',
   params:{p_recipient_code:valid.code,p_amount_cents:valid.cents,p_request_id:valid.id},
 };
 return {
   rpc:'mwd_contribute_demo',
   params:{p_amount_cents:valid.cents,p_request_id:valid.id},
 };
}
