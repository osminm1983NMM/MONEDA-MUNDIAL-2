'use strict';
// Client contract for an explicitly approved sandbox server, not wired to Android.
const {route}=require('./order-status-route.cjs');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const {validOrderStatus}=require('./order-status-contract.cjs');
const fail=code=>({ok:false,code});
async function readJson(response,signal){
 const reader=response.body?.getReader();
 if(!reader)throw Error('INVALID_RESPONSE');
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 let size=0;let ascii='';
 try{
  while(true){
   if(signal.aborted)throw Error('ABORTED');
   const {done,value}=await reader.read();
   if(signal.aborted)throw Error('ABORTED');
   if(done)break;
   size+=value.byteLength;if(size>8192)throw Error('INVALID_RESPONSE');
   // The entire status wire schema consists of ASCII identifiers, dates and amounts.
   // Reject other bytes and bound decoding before constructing the JSON value.
   if(!(value instanceof Uint8Array))throw Error('INVALID_RESPONSE');
   for(const byte of value){if(byte>127)throw Error('INVALID_RESPONSE');ascii+=String.fromCharCode(byte);}
  }
 }catch(e){cancel();throw e;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const parsed=JSON.parse(ascii);
 // This internal server emits compact JSON; reject duplicate keys or escaped aliases.
 if(JSON.stringify(parsed)!==ascii)throw Error('INVALID_RESPONSE');
 return parsed;
}
function createOrderStatusClient({environment,sandboxOrigin,fetchImpl=globalThis.fetch,timeoutMs=10000}={}){
 if(environment!=='sandbox'||typeof fetchImpl!=='function'||typeof sandboxOrigin!=='string'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('SANDBOX_ONLY');
 const origin=new URL(sandboxOrigin);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.href!==origin.origin+'/')throw Error('INVALID_ORIGIN');
 const endpoint=origin.origin+route;
 return Object.freeze({async read({sessionToken,orderId}={}){
  if(typeof sessionToken!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(sessionToken))return fail('AUTH_REQUIRED');
  if(typeof orderId!=='string'||!uuid.test(orderId))return fail('INVALID_REQUEST');
  const controller=new AbortController();
  // Bound the caller's wait even if the injected transport ignores abort.
  // The losing operation remains observed by Promise.race; a late response
  // is discarded and its body cancelled without parsing or publishing it.
  let timer;
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>{
   resolve(fail('UNAVAILABLE'));controller.abort();
  },timeoutMs);});
  const operation=async()=>{try{
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
    headers:{authorization:'Bearer '+sessionToken,'content-type':'application/json'},body:JSON.stringify({orderId}),signal:controller.signal});
   if(controller.signal.aborted||response.redirected||(response.url&&response.url!==endpoint)){
    void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
   }
   if(response.status!==200){
    void response.body?.cancel().catch(()=>{});
    return fail(({400:'INVALID_REQUEST',401:'AUTH_REQUIRED',404:'NOT_FOUND'})[response.status]??'UNAVAILABLE');
   }
   if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||
     response.headers.get('cache-control')?.trim().toLowerCase()!=='no-store'){
    void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
   }
   const value=await readJson(response,controller.signal);
   return !controller.signal.aborted&&validOrderStatus(value,orderId)?{ok:true,value}:fail('UNAVAILABLE');
  }catch{return fail('UNAVAILABLE');}};
  try{return await Promise.race([operation(),deadline]);}finally{clearTimeout(timer);}
 }});
}
module.exports={createOrderStatusClient};
