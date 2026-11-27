'use strict';
// Mobile wallet state controller. No persistence, no credentials in view, no network
// except through the injected sandbox client. Not mounted in the Android app yet.
const {validPortfolio}=require('../digital-coin-portfolio-contract.cjs');
const tokenOk=v=>typeof v==='string'&&/^[A-Za-z0-9._~-]{1,8192}$/.test(v);
function createPortfolioHost({environment,enabled=false,client,onChange,requireSnapshot=false}={}){
 if(environment!=='sandbox'||typeof enabled!=='boolean'||typeof requireSnapshot!=='boolean'||typeof onChange!=='function'||(enabled&&typeof client?.read!=='function'))throw Error('INVALID_HOST');
 let disposed=false,token=null,revision=0,active=null,state='signed_out';
 function publish(next,value,code,snapshot){
  state=next;
  onChange({enabled:enabled&&!disposed&&token!==null,revision,state:next,...(value===undefined?{}:{value}),...(code===undefined?{}:{code}),...(snapshot===undefined?{}:{snapshot})});
 }
 function invalidate(){revision++;const old=active;active=null;old?.abort();}
 function setSession(next){
  if(disposed)return;
  invalidate();
  token=enabled&&tokenOk(next)?next:null;
  publish(token?'idle':'signed_out');
 }
 async function refresh(expectedRevision){
  if(disposed||!enabled||!token||expectedRevision!==revision||active)return;
  const current=revision,controller=new AbortController(),session=token;
  active=controller;publish('loading');
  // A synchronous view callback may have changed the current account.
  if(disposed||current!==revision||active!==controller)return;
  let result;
  try{result=await client.read(session,controller.signal);}catch{result={ok:false,code:'UNAVAILABLE'};}
  if(disposed||current!==revision||active!==controller||controller.signal.aborted)return;
  active=null;
  try{
   if(result?.ok===true){
    // Publish a detached, validated JSON value, not a mutable transport reference.
    const value=JSON.parse(JSON.stringify(result.value));
    const snapshot=result.snapshot===undefined?undefined:JSON.parse(JSON.stringify(result.snapshot));
    const dated=snapshot&&Object.keys(snapshot).length===2&&snapshot.kind==='immutable_wallet_snapshot'&&typeof snapshot.exportedAt==='string'&&Number.isFinite(Date.parse(snapshot.exportedAt))&&new Date(snapshot.exportedAt).toISOString()===snapshot.exportedAt;
    if(validPortfolio(value)&&(requireSnapshot?dated:snapshot===undefined)){publish('ready',value,undefined,snapshot);return;}
   }
  }catch{}
  if(result?.ok===false&&result.code==='AUTH_REQUIRED'){
   invalidate();token=null;publish('signed_out');return;
  }
  publish('error',undefined,'UNAVAILABLE');
 }
 function dispose(){
  if(disposed)return;
  disposed=true;invalidate();token=null;publish('signed_out');
 }
 return Object.freeze({setSession,refresh,dispose});
}
module.exports={createPortfolioHost};
