'use strict';
// Read-only mobile composition. No App.js import, remote credentials or default origin.
const {createExpoOrderStatusClient}=require('./order-status-expo.js');
const {createStatusPresentation}=require('../order-status-presentation.cjs');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const tokenOk=v=>typeof v==='string'&&/^[A-Za-z0-9._~-]{1,8192}$/.test(v);
function createRemittanceStatusHost({environment,enabled=false,sandboxOrigin,expoFetch,locale='es',onChange}={}){
 if(environment!=='sandbox'||!['es','en'].includes(locale)||typeof onChange!=='function')throw Error('INVALID_HOST');
 let closed=false,session=null,orderId=null,view={state:'signed_out'},controller=null,selectionRevision=0;
 const publish=()=>onChange({enabled:enabled===true&&session!==null&&orderId!==null,orderId,locale,view,selectionRevision});
 if(enabled===true){
  const client=createExpoOrderStatusClient({environment,enabled,sandboxOrigin,expoFetch});
  controller=createStatusPresentation({client,locale,onChange:next=>{view=next;publish();}});
 }
 function setSession(next){
  if(closed)return;
  // Clear selected order even when the token refreshes. The caller can reselect
  // a known current-session order. Invalid session input also clears access.
  selectionRevision++;
  orderId=null;session=controller&&tokenOk(next)?next:null;
  if(controller)controller.setSession(session);
  else{view={state:'signed_out'};publish();}
 }
 function selectOrder(next){
  if(closed)return;
  selectionRevision++;
  orderId=session&&typeof next==='string'&&uuid.test(next)?next:null;
  if(controller)controller.clear();else publish();
 }
 async function refresh(expectedOrder,expectedRevision){
  // A delayed press from an obsolete render cannot start a request under
  // a replacement session, even if the same order has been reselected.
  if(closed||!controller||!session||!orderId||expectedOrder!==orderId||expectedRevision!==selectionRevision||view.state==='loading')return;
  await controller.read(orderId);
 }
 function dispose(){
  if(closed)return;
  closed=true;selectionRevision++;session=null;orderId=null;controller?.dispose();
  view={state:'signed_out'};publish();
 }
 return Object.freeze({setSession,selectOrder,refresh,dispose});
}
module.exports={createRemittanceStatusHost};
