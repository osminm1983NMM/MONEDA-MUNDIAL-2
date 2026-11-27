'use strict';
// Client contract for an explicitly approved sandbox server, not wired to Android.
const {route}=require('./order-status-route.cjs');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const states=new Set(['funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const amount=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(x)&&BigInt(x)<=9223372036854775807n;
const fail=code=>({ok:false,code});
function valid(x,id){
 if(!exact(x,['mode','orderId','status','source','destination','acceptedAt'])||x.mode!=='sandbox'||x.orderId!==id||!states.has(x.status)||
 !exact(x.source,['currency','principalMinor','feeMinor','totalMinor'])||x.source.currency!=='USD'||
 !exact(x.destination,['currency','amountMinor'])||x.destination.currency!=='HNL')return false;
 const {principalMinor:p,feeMinor:f,totalMinor:t}=x.source,d=x.destination.amountMinor;
 if(![p,f,t,d].every(amount)||p==='0'||d==='0'||BigInt(p)+BigInt(f)!==BigInt(t))return false;
 if(typeof x.acceptedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x.acceptedAt))return false;
 const date=new Date(x.acceptedAt);
 return Number.isFinite(date.getTime())&&date.toISOString()===x.acceptedAt;
}
async function readJson(response){
 const reader=response.body?.getReader();
 if(!reader)throw Error('INVALID_RESPONSE');
 let size=0;let ascii='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;if(size>8192)throw Error('INVALID_RESPONSE');
   // The entire status wire schema consists of ASCII identifiers, dates and amounts.
   // Reject other bytes and bound decoding before constructing the JSON value.
   if(!(value instanceof Uint8Array))throw Error('INVALID_RESPONSE');
   for(const byte of value){if(byte>127)throw Error('INVALID_RESPONSE');ascii+=String.fromCharCode(byte);}
  }
 }catch(e){void reader.cancel().catch(()=>{});throw e;}
 finally{reader.releaseLock();}
 return JSON.parse(ascii);
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
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
    headers:{authorization:'Bearer '+sessionToken,'content-type':'application/json'},body:JSON.stringify({orderId}),signal:controller.signal});
   if(response.redirected||(response.url&&response.url!==endpoint))return fail('UNAVAILABLE');
   if(response.status!==200){
    void response.body?.cancel().catch(()=>{});
    return fail(({400:'INVALID_REQUEST',401:'AUTH_REQUIRED',404:'NOT_FOUND'})[response.status]??'UNAVAILABLE');
   }
   if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||
     response.headers.get('cache-control')?.trim().toLowerCase()!=='no-store'){
    void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
   }
   const value=await readJson(response);
   return !controller.signal.aborted&&valid(value,orderId)?{ok:true,value}:fail('UNAVAILABLE');
  }catch{return fail('UNAVAILABLE');}finally{clearTimeout(timer);}
 }});
}
module.exports={createOrderStatusClient};
