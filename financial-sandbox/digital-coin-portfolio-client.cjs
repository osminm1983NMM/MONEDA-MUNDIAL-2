'use strict';
// Portable client for a separately approved HTTPS sandbox host. No live endpoint.
const {validPortfolio}=require('./digital-coin-portfolio-contract.cjs');
const fail=code=>({ok:false,code});
// Maximum 2000 bounded ASCII conversion records plus balances.
const maxBytes=1024*1024+1024;
const hostedOrigin='https://tfamyuqqpenilnovqjpp.supabase.co';
function labToken(token){
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return false;
 try{const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let bits=0,n=0,encoded='';const part=token.split('.')[1];if(part.length%4===1)return false;
 for(const ch of part){bits=(bits<<6)|chars.indexOf(ch);n+=6;if(n>=8){n-=8;encoded+='%'+((bits>>n)&255).toString(16).padStart(2,'0');}}
 const j=JSON.parse(decodeURIComponent(encoded));return j?.iss===hostedOrigin+'/auth/v1'&&j.role==='authenticated'&&j.is_anonymous===false;}catch{return false;}
}
function compactJson(raw){let out='',quoted=false,escaped=false;for(const ch of raw){if(quoted){out+=ch;if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}else if(ch==='"'){quoted=true;out+=ch;}else if(!' \t\r\n'.includes(ch))out+=ch;}return out;}
function validSnapshot(x){return x!==null&&typeof x==='object'&&Object.keys(x).length===3&&x.kind==='immutable_wallet_snapshot'&&typeof x.exportedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x.exportedAt)&&Number.isFinite(Date.parse(x.exportedAt))&&new Date(x.exportedAt).toISOString()===x.exportedAt&&validPortfolio(x.portfolio);}
async function readPayload(response,signal,hosted){
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
 if(JSON.stringify(value)!==(hosted?compactJson(raw):raw)||!(hosted?(value===null||validSnapshot(value)):validPortfolio(value)))throw Error('INVALID_RESPONSE');
 return value;
}
function createPortfolioClient({environment,sandboxOrigin,fetchImpl=globalThis.fetch,timeoutMs=10000,maxActive=8,transport='isolated-http',publishableKey}={}){
 if(environment!=='sandbox'||typeof fetchImpl!=='function'||typeof sandboxOrigin!=='string')throw Error('SANDBOX_ONLY');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000||!Number.isInteger(maxActive)||maxActive<1||maxActive>32)throw Error('INVALID_LIMITS');
 const origin=new URL(sandboxOrigin);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.href!==origin.origin+'/')throw Error('INVALID_ORIGIN');
 const hosted=transport==='hosted-snapshot';
 if(!['isolated-http','hosted-snapshot'].includes(transport))throw Error('INVALID_TRANSPORT');
 if(hosted?(origin.origin!==hostedOrigin||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(publishableKey)):(publishableKey!==undefined||origin.origin===hostedOrigin))throw Error('INVALID_HOSTED_CONFIG');
 const endpoint=origin.origin+(hosted?'/rest/v1/rpc/mwd_lab_read_wallet_snapshot':'/v1/sandbox/wallet/portfolio');
 let active=0;
 return Object.freeze({async read(sessionToken,signal){
  if(typeof sessionToken!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(sessionToken))return fail('AUTH_REQUIRED');
  if(hosted&&!labToken(sessionToken))return fail('AUTH_REQUIRED');
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
    const response=await fetchImpl(endpoint,{method:hosted?'POST':'GET',redirect:'error',cache:'no-store',credentials:'omit',headers:{authorization:'Bearer '+sessionToken,accept:'application/json',...(hosted?{apikey:publishableKey,'content-type':'application/json','cache-control':'no-store'}:{})},...(hosted?{body:'{}'}:{}),signal:controller.signal});
    if(controller.signal.aborted||response.redirected||(response.url&&response.url!==endpoint)){
     void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
    }
    if(response.status!==200){void response.body?.cancel().catch(()=>{});return fail([401,403].includes(response.status)?'AUTH_REQUIRED':'UNAVAILABLE');}
    if(response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||(!hosted&&response.headers.get('cache-control')?.trim().toLowerCase()!=='no-store')){
     void response.body?.cancel().catch(()=>{});return fail('UNAVAILABLE');
    }
    const value=await readPayload(response,controller.signal,hosted);
    return controller.signal.aborted?fail('UNAVAILABLE'):hosted?(value===null?fail('AUTH_REQUIRED'):{ok:true,value:value.portfolio,snapshot:{kind:value.kind,exportedAt:value.exportedAt}}):{ok:true,value};
   }catch{return fail('UNAVAILABLE');}
  })().finally(()=>{active--;});
  try{return await Promise.race([operation,deadline]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }});
}
module.exports={createPortfolioClient,validSnapshot};
