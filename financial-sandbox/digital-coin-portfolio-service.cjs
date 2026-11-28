'use strict';
// Internal server-only composition. The host MUST supply a revocation-aware
// trusted session verifier. Never expose the raw ledger or use client actor IDs.
const {readDigitalCoinPortfolio}=require('./digital-coin-portfolio.cjs');
// Snapshot only enumerable own data fields; never invoke an accessor or
// accept inherited, hidden or symbol fields at an identity boundary.
function ownData(value,keys){
 try{
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const fields=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(fields).length!==keys.length)return null;
  const out=Object.create(null);
  for(const k of keys){
   if(!Object.hasOwn(fields,k)||!fields[k].enumerable||!Object.hasOwn(fields[k],'value'))return null;
   out[k]=fields[k].value;
  }
  return out;
 }catch{return null;}
}
function createDigitalCoinPortfolioService({environment,verifySession,readPortfolio}={}){
 if(environment!=='sandbox'||typeof verifySession!=='function'||typeof readPortfolio!=='function')throw Error('SANDBOX_ONLY');
 const error=(status,code)=>({status,body:{mode:'sandbox',error:code}});
 return Object.freeze({async read(request,signal){
  const input=ownData(request,['sessionToken']);
  if(!input)return error(400,'INVALID_REQUEST');
  const token=input.sessionToken;
  if(typeof token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(token))return error(401,'AUTH_REQUIRED');
  if(signal?.aborted)return error(503,'UNAVAILABLE');
  try{
   const session=await verifySession(token,signal);
   if(signal?.aborted)return error(503,'UNAVAILABLE');
   const identity=ownData(session,['environment','actor']);
   if(!identity||identity.environment!=='sandbox'||typeof identity.actor!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(identity.actor)||identity.actor==='treasury')return error(401,'AUTH_REQUIRED');
   const body=await readPortfolio(identity.actor,signal);
   if(signal?.aborted)return error(503,'UNAVAILABLE');
   return {status:200,body};
  }catch{return error(503,'UNAVAILABLE');}
 }});
}
function createLedgerPortfolioService({environment,verifySession,ledger}={}){
 if(typeof ledger?.reconciliationSnapshot!=='function')throw Error('INVALID_LEDGER');
 return createDigitalCoinPortfolioService({environment,verifySession,readPortfolio:actor=>readDigitalCoinPortfolio({environment,ledger,verifiedActor:actor})});
}
module.exports={createLedgerPortfolioService};
