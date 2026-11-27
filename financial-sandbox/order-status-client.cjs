'use strict';
// Client contract for an explicitly approved sandbox server, not wired to Android.
const {route}=require('./order-status-route.cjs');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const {validOrderStatus}=require('./order-status-contract.cjs');
const fail=code=>({ok:false,code});
const hostedOrigin='https://tfamyuqqpenilnovqjpp.supabase.co';
function hostedToken(token){
 // Local issuer/role check only, NOT authentication. The gateway verifies the signature.
 // Avoid accidentally transmitting a DEMO token to the separate hosted project.
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return false;
 try{
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const part=token.split('.')[1];if(part.length%4===1)return false;
  let bits=0,n=0,encoded='';
  for(const ch of part){bits=(bits<<6)|chars.indexOf(ch);n+=6;if(n>=8){n-=8;encoded+='%'+((bits>>n)&255).toString(16).padStart(2,'0');}}
  const j=JSON.parse(decodeURIComponent(encoded));
  return j?.iss===hostedOrigin+'/auth/v1'&&j.role==='authenticated'&&j.is_anonymous===false;
 }catch{return false;}
}
function compactJson(text){
 let result='',quoted=false,escaped=false;
 for(const ch of text){
  if(quoted){result+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}
  else if(ch==='"'){quoted=true;result+=ch;}
  else if(!' \t\r\n'.includes(ch))result+=ch;
 }
 return result;
}
async function readJson(response,signal,hosted=false){
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
 if(JSON.stringify(parsed)!==(hosted?compactJson(ascii):ascii))throw Error('INVALID_RESPONSE');
 return parsed;
}
function createOrderStatusClient({environment,sandboxOrigin,fetchImpl=globalThis.fetch,timeoutMs=10000,maxActive=8,transport='isolated-http',publishableKey}={}){
 if(environment!=='sandbox'||typeof fetchImpl!=='function'||typeof sandboxOrigin!=='string'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isInteger(maxActive)||maxActive<1||maxActive>32)throw Error('SANDBOX_ONLY');
 const origin=new URL(sandboxOrigin);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.href!==origin.origin+'/')throw Error('INVALID_ORIGIN');
 const hosted=transport==='hosted-rpc';
 if(!['isolated-http','hosted-rpc'].includes(transport))throw Error('INVALID_TRANSPORT');
 if(hosted?(origin.origin!==hostedOrigin||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(publishableKey)):(publishableKey!==undefined||origin.origin===hostedOrigin))throw Error('INVALID_HOSTED_CONFIG');
 const endpoint=origin.origin+(hosted?'/rest/v1/rpc/mwd_lab_read_status':route);
 let active=0;
 return Object.freeze({async read({sessionToken,orderId}={},signal){
  if(typeof sessionToken!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(sessionToken))return fail('AUTH_REQUIRED');
  if(hosted&&!hostedToken(sessionToken))return fail('AUTH_REQUIRED');
  if(typeof orderId!=='string'||!uuid.test(orderId))return fail('INVALID_REQUEST');
  // Retain capacity until the underlying transport actually settles, not
  // merely until the caller's deadline. A stuck transport cannot grow without bound.
  if(signal!==undefined&&(!signal||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'||typeof signal.aborted!=='boolean'))return fail('INVALID_REQUEST');
  if(signal?.aborted||active>=maxActive)return fail('UNAVAILABLE');
  active++;
  const controller=new AbortController();
  // Bound the caller's wait even if the injected transport ignores abort.
  // The losing operation remains observed by Promise.race; a late response
  // is discarded and its body cancelled without parsing or publishing it.
  let timer,cancel;
  const deadline=new Promise(resolve=>{
   cancel=()=>{resolve(fail('UNAVAILABLE'));controller.abort();};
   timer=setTimeout(cancel,timeoutMs);
  });
  signal?.addEventListener('abort',cancel,{once:true});
  const operation=async()=>{try{
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
    headers:{authorization:'Bearer '+sessionToken,'content-type':'application/json',...(hosted?{apikey:publishableKey,'cache-control':'no-store',accept:'application/json'}:{})},body:JSON.stringify(hosted?{p_order:orderId}:{orderId}),signal:controller.signal});
   if(controller.signal.aborted||response.redirected||(response.url&&response.url!==endpoint)){
    void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
   }
   if(response.status!==200){
    void response.body?.cancel().catch(()=>{});
    return fail(({400:'INVALID_REQUEST',401:'AUTH_REQUIRED',404:'NOT_FOUND'})[response.status]??'UNAVAILABLE');
   }
   if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||
     (!hosted&&response.headers.get('cache-control')?.trim().toLowerCase()!=='no-store')){
    void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
   }
   const value=await readJson(response,controller.signal,hosted);
   if(hosted&&value===null&&!controller.signal.aborted)return fail('NOT_FOUND');
   return !controller.signal.aborted&&validOrderStatus(value,orderId)?{ok:true,value}:fail('UNAVAILABLE');
  }catch{return fail('UNAVAILABLE');}};
  try{return await Promise.race([operation().finally(()=>{active--;}),deadline]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }});
}
module.exports={createOrderStatusClient};
