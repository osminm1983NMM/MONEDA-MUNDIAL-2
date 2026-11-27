'use strict';
// Portable client for a separately approved HTTPS sandbox host. No live endpoint.
const {validPortfolio}=require('./digital-coin-portfolio-contract.cjs');
const fail=code=>({ok:false,code});
// Maximum 2000 bounded ASCII conversion records plus balances.
const maxBytes=1024*1024;
async function readPayload(response,signal){
 const reader=response.body?.getReader();
 if(!reader)throw Error('INVALID_RESPONSE');
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 let size=0;const chunks=[];
 try{
  while(true){
   if(signal.aborted)throw Error('ABORTED');
   const {done,value}=await reader.read();
   if(signal.aborted)throw Error('ABORTED');
   if(done)break;
   if(!(value instanceof Uint8Array)||(size+=value.byteLength)>maxBytes)throw Error('INVALID_RESPONSE');
   for(const byte of value)if(byte>127)throw Error('INVALID_RESPONSE');
   chunks.push('');
   for(let offset=0;offset<value.length;offset+=8192)chunks[chunks.length-1]+=String.fromCharCode(...value.subarray(offset,offset+8192));
  }
 }catch(e){cancel();throw e;}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const raw=chunks.join(''),value=JSON.parse(raw);
 if(JSON.stringify(value)!==raw||!validPortfolio(value))throw Error('INVALID_RESPONSE');
 return value;
}
function createPortfolioClient({environment,sandboxOrigin,fetchImpl=globalThis.fetch,timeoutMs=10000,maxActive=8}={}){
 if(environment!=='sandbox'||typeof fetchImpl!=='function'||typeof sandboxOrigin!=='string')throw Error('SANDBOX_ONLY');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isInteger(maxActive)||maxActive<1||maxActive>32)throw Error('INVALID_LIMITS');
 const origin=new URL(sandboxOrigin);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.href!==origin.origin+'/')throw Error('INVALID_ORIGIN');
 const endpoint=origin.origin+'/v1/sandbox/wallet/portfolio';
 let active=0;
 return Object.freeze({async read(sessionToken,signal){
  if(typeof sessionToken!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(sessionToken))return fail('AUTH_REQUIRED');
  if(signal!==undefined&&(!signal||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'||typeof signal.aborted!=='boolean'))return fail('INVALID_REQUEST');
  if(signal?.aborted||active>=maxActive)return fail('UNAVAILABLE');
  active++;
  const controller=new AbortController();
  let timer,cancel;
  const deadline=new Promise(resolve=>{
   cancel=()=>{resolve(fail('UNAVAILABLE'));controller.abort();};
   timer=setTimeout(cancel,timeoutMs);
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  });
  const operation=(async()=>{
   try{
    if(controller.signal.aborted)return fail('UNAVAILABLE');
    const response=await fetchImpl(endpoint,{method:'GET',redirect:'error',cache:'no-store',credentials:'omit',headers:{authorization:'Bearer '+sessionToken,accept:'application/json'},signal:controller.signal});
    if(controller.signal.aborted||response.redirected||(response.url&&response.url!==endpoint)){
     void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
    }
    if(response.status!==200){void response.body?.cancel().catch(()=>{});return fail(response.status===401?'AUTH_REQUIRED':'UNAVAILABLE');}
    if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||response.headers.get('cache-control')?.trim().toLowerCase()!=='no-store'){
     void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
    }
    const value=await readPayload(response,controller.signal);
    return controller.signal.aborted?fail('UNAVAILABLE'):{ok:true,value};
   }catch{return fail('UNAVAILABLE');}
  })().finally(()=>{active--;});
  try{return await Promise.race([operation,deadline]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }});
}
module.exports={createPortfolioClient};
