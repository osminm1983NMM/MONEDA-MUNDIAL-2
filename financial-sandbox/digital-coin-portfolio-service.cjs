'use strict';
// Internal server-only composition. The host MUST supply a revocation-aware
// trusted session verifier. Never expose the raw ledger or use client actor IDs.
const {readDigitalCoinPortfolio}=require('./digital-coin-portfolio.cjs');
function createDigitalCoinPortfolioService({environment,verifySession,readPortfolio}={}){
 if(environment!=='sandbox'||typeof verifySession!=='function'||typeof readPortfolio!=='function')throw Error('SANDBOX_ONLY');
 const error=(status,code)=>({status,body:{mode:'sandbox',error:code}});
 return Object.freeze({async read(request,signal){
  if(!request||typeof request!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(request)))return error(400,'INVALID_REQUEST');
  const fields=Object.getOwnPropertyDescriptors(request),keys=Reflect.ownKeys(fields);
  if(keys.length!==1||keys[0]!=='sessionToken'||!fields.sessionToken.enumerable||!Object.hasOwn(fields.sessionToken,'value'))return error(400,'INVALID_REQUEST');
  const token=fields.sessionToken.value;
  if(typeof token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(token))return error(401,'AUTH_REQUIRED');
  if(signal?.aborted)return error(503,'UNAVAILABLE');
  try{
   const session=await verifySession(token,signal);
   if(signal?.aborted)return error(503,'UNAVAILABLE');
   if(!session||session.environment!=='sandbox'||typeof session.actor!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(session.actor)||session.actor==='treasury')return error(401,'AUTH_REQUIRED');
   const body=await readPortfolio(session.actor,signal);
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
