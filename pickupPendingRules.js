// Recuperación local SOLO DEMO para solicitud de código de retiro.
// Nunca guardar el código SIM-..., contraseñas, documentos o claves.
// El servidor impone autorización por auth.uid() y unicidad requestId/actor.
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function pickupPendingStorageKeyDemo(userId){
 return typeof userId==='string'&&UUID.test(userId)
  ? 'moneda-mundial:pickup-pending-demo:v1:'+userId.toLowerCase() : null;
}
function validRequest(request){
 if(!request||typeof request!=='object'||Array.isArray(request)||
    typeof request.id!=='string'||!UUID.test(request.id)||
    typeof request.country!=='string'||!/^[A-Z]{2}$/.test(request.country)||
    !Number.isSafeInteger(request.cents)||request.cents<100||request.cents>100000)
  return null;
 return {id:request.id.toLowerCase(),country:request.country,cents:request.cents};
}
function serializePickupPendingDemo(request){
 const v=validRequest(request);
 if(!v)return null;
 return JSON.stringify({version:1,mode:'sandbox_only',realPaymentsEnabled:false,...v});
}
function deserializePickupPendingDemo(raw){
 if(typeof raw!=='string'||raw.length>512)return null;
 try{
  const x=JSON.parse(raw);
  if(!x||x.version!==1||x.mode!=='sandbox_only'||
     x.realPaymentsEnabled!==false||
     Object.keys(x).sort().join(',')!==
      ['version','mode','realPaymentsEnabled','id','country','cents'].sort().join(','))return null;
  return validRequest(x);
 }catch{return null;}
}
module.exports={pickupPendingStorageKeyDemo,serializePickupPendingDemo,deserializePickupPendingDemo};
