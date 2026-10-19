// Estado local de una confirmación SIMULADA cuyo resultado todavía es incierto.
// No contiene tarjetas, claves, saldo en USD, autenticadores ni secretos.
// El servidor siempre verifica la pertenencia del quoteId al usuario autenticado.
const ID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ASSETS=['COIN','STABLE'];
const int=x=>Number.isSafeInteger(x)&&x>=0;
const timestamp=x=>typeof x==='string' &&
  /T.*(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x));

export function demoPendingStorageKey(userId) {
 return typeof userId==='string' && ID.test(userId)
   ? 'moneda-mundial:pending-conversion-demo:v1:'+userId.toLowerCase() : null;
}
export function encodePendingDemoQuote(q) {
 if(!q||q.status!=='quoted'||q.provider!=='synthetic_sandbox'||
    q.realPaymentsEnabled!==false||q.priceIsReal!==false) return null;
 const payload={
  version:1,mode:'sandbox_only',quoteId:q.quoteId,
  fromAsset:q.fromAsset,toAsset:q.toAsset,
  amountInMicro:q.amountInMicro,amountOutMicro:q.amountOutMicro,
  feeOutMicro:q.feeOutMicro,expiresAt:q.expiresAt,
  realPaymentsEnabled:false
 };
 return validatePendingDemoQuote(payload) ? JSON.stringify(payload) : null;
}
export function decodePendingDemoQuote(serialized) {
 if(typeof serialized!=='string'||serialized.length>2048)return null;
 try { return validatePendingDemoQuote(JSON.parse(serialized)); }
 catch { return null; }
}
function validatePendingDemoQuote(q) {
 if(!q||typeof q!=='object'||Array.isArray(q)||
    q.version!==1||q.mode!=='sandbox_only'||q.realPaymentsEnabled!==false||
    typeof q.quoteId!=='string'||!ID.test(q.quoteId)||
    !ASSETS.includes(q.fromAsset)||!ASSETS.includes(q.toAsset)||
    q.fromAsset===q.toAsset||
    !int(q.amountInMicro)||q.amountInMicro<1000000||q.amountInMicro>10000000000||
    !int(q.amountOutMicro)||q.amountOutMicro<=0||
    !int(q.feeOutMicro)||!timestamp(q.expiresAt)) return null;
 return {
  quoteId:q.quoteId,fromAsset:q.fromAsset,toAsset:q.toAsset,
  amountInMicro:q.amountInMicro,amountOutMicro:q.amountOutMicro,
  feeOutMicro:q.feeOutMicro,expiresAt:q.expiresAt,
  realPaymentsEnabled:false
 };
}

/**
 * Classifica el resultado del RPC que SOLO consulta el estado de una operación.
 * El resultado no da permiso para alterar el libro: solo permite cerrar el aviso local.
 * Devuelve null ante datos incompletos, ajenos o potencialmente falsificados.
 */
export function classifyDemoReconciliation(response,pending) {
 if(!pending||pending.unavailable||!response||typeof response!=='object'||
    response.mode!=='sandbox_only'||response.realPaymentsEnabled!==false||
    !ID.test(response.quoteId||'')||response.quoteId!==pending.quoteId||
    response.fromAsset!==pending.fromAsset||response.toAsset!==pending.toAsset)return null;
 for(const field of ['amountInMicro','amountOutMicro','feeOutMicro']){
   const value=response[field];
   const parsed=typeof value==='number'?value:
      typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)?Number(value):NaN;
   if(!Number.isSafeInteger(parsed)||parsed!==pending[field])return null;
 }
 if(response.status==='quoted'||response.status==='expired')
   return response.conversionId===null?response.status:null;
 if(response.status==='executed')
   return typeof response.conversionId==='string'&&ID.test(response.conversionId)
     ? 'executed' : null;
 return null;
}
