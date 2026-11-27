'use strict';
// Server-only adapter for the fixed, independent LAB. The RPC checks the
// signed bearer, live auth.sessions entry and active remittance binding.
// Wallet access additionally requires explicit server-owned enrollment.
const {createLedgerPortfolioService}=require('./digital-coin-portfolio-service.cjs');
const endpoint='https://tfamyuqqpenilnovqjpp.supabase.co/rest/v1/rpc/mwd_lab_session_identity';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
async function smallJson(response,signal){
 const reader=response.body?.getReader();if(!reader)throw Error('IDENTITY_UNAVAILABLE');
 const cancel=()=>{void reader.cancel().catch(()=>{});};
 signal?.addEventListener('abort',cancel,{once:true});
 let size=0,raw='';
 try{
  while(true){
   if(signal?.aborted)throw Error('ABORTED');
   const {done,value}=await reader.read();
   if(signal?.aborted)throw Error('ABORTED');
   if(done)break;
   if(!(value instanceof Uint8Array)||(size+=value.byteLength)>512)throw Error('IDENTITY_UNAVAILABLE');
   for(const b of value){if(b>127)throw Error('IDENTITY_UNAVAILABLE');raw+=String.fromCharCode(b);}
  }
  const compact=raw.replace(/[ \t\r\n]/g,'');
  const data=JSON.parse(raw);
  // Fixed ASCII value schema; reject ambiguous or duplicate keys.
  if(JSON.stringify(data)!==compact)throw Error('IDENTITY_UNAVAILABLE');
  return data;
 }catch(e){cancel();throw e;}
 finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
}
function createHostedWalletVerifier({environment,publishableKey,enrolledActors,fetchImpl=globalThis.fetch}={}){
 if(environment!=='sandbox'||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(publishableKey)||typeof fetchImpl!=='function')throw Error('LAB_CONFIGURATION_REQUIRED');
 if(!Array.isArray(enrolledActors)||enrolledActors.length>10000||!enrolledActors.every(uuid)||new Set(enrolledActors).size!==enrolledActors.length)throw Error('INVALID_ENROLLMENT');
 const allowed=new Set(enrolledActors);
 return async function verifySession(token,signal){
  if(typeof token!=='string'||token.length>8192||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null;
  // Local routing check, never a signature/identity decision.
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{return null;}
  if(claims?.iss!=='https://tfamyuqqpenilnovqjpp.supabase.co/auth/v1'||claims.role!=='authenticated'||claims.is_anonymous!==false||!uuid(claims.sub)||!allowed.has(claims.sub))return null;
  if(signal?.aborted)throw Error('ABORTED');
  const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',headers:{apikey:publishableKey,authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json'},body:'{}',signal});
  const discard=()=>{void response.body?.cancel().catch(()=>{});};
  if(signal?.aborted||response.redirected||(response.url&&response.url!==endpoint)){discard();throw Error('IDENTITY_UNAVAILABLE');}
  if([401,403].includes(response.status)){discard();return null;}
  if(response.status!==200||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){discard();throw Error('IDENTITY_UNAVAILABLE');}
  const identity=await smallJson(response,signal);
  if(identity===null)return null;
  if(!identity||Object.keys(identity).length!==2||identity.environment!=='sandbox'||identity.actor!==claims.sub||!allowed.has(identity.actor))throw Error('IDENTITY_UNAVAILABLE');
  return {environment:'sandbox',actor:identity.actor};
 };
}
function createHostedWalletService({environment,enabled=false,publishableKey,enrolledActors,fetchImpl,ledger}={}){
 if(environment!=='sandbox'||enabled!==true||ledger?.reconciliationRequired?.()!==true||ledger?.verifiedPricingRequired?.()!==true)throw Error('HOSTED_WALLET_DISABLED');
 return createLedgerPortfolioService({environment,ledger,verifySession:createHostedWalletVerifier({environment,publishableKey,enrolledActors,fetchImpl})});
}
module.exports={createHostedWalletVerifier,createHostedWalletService};
