'use strict';
// Pure, portable UI projection of a validated sandbox client response.
// No React Native dependency, network, storage or production activation.
const {validOrderStatus}=require('./order-status-contract.cjs');
const labels={
 funding_pending:['Financiación pendiente','Funding pending'],
 funding_failed:['Financiación no completada','Funding not completed'],
 funded:['Financiación confirmada en prueba','Funding confirmed in test'],
 payout_pending:['Entrega pendiente','Payout pending'],
 payout_failed:['Entrega no completada','Payout not completed'],
 paid:['Entrega confirmada en prueba','Payout confirmed in test'],
 refund_pending:['Devolución pendiente','Refund pending'],
 refunded:['Devolución confirmada en prueba','Refund confirmed in test']
};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const money=(v,currency,locale)=>{
 if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(v)||v.length===19&&v>'9223372036854775807')throw Error('INVALID_AMOUNT');
 const digits=v.padStart(3,'0');
 const whole=digits.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,locale==='es'?'.':',');
 return whole+(locale==='es'?',':'.')+digits.slice(-2)+' '+currency;
};
function presentStatus(value,locale='es'){
 if(!['es','en'].includes(locale)||typeof value?.orderId!=='string'||!uuid.test(value.orderId)||!validOrderStatus(value,value.orderId))throw Error('INVALID_STATUS');
 const en=locale==='en';
 return {mode:'sandbox',orderId:value.orderId,statusLabel:labels[value.status][en?1:0],
 warning:en?'TEST ONLY — NO REAL MONEY':'PRUEBA — SIN DINERO REAL',
 principal:money(value.source.principalMinor,'USD',locale),fee:money(value.source.feeMinor,'USD',locale),
 total:money(value.source.totalMinor,'USD',locale),destination:money(value.destination.amountMinor,'HNL',locale),
 acceptedAt:value.acceptedAt};
}
// A host must replace the session on sign-in, sign-out or token change.
// Invalidates delayed requests and clears state synchronously. No cache.
function createStatusPresentation({client,locale='es',onChange}={}){
 if(typeof client?.read!=='function'||typeof onChange!=='function'||!['es','en'].includes(locale))throw Error('INVALID_HOST');
 let token=null,revision=0,closed=false;
 const publish=state=>onChange(state);
 function setSession(next){
  if(closed)return;
  if(next!==null&&(typeof next!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(next)))throw Error('INVALID_SESSION');
  revision++;token=next;publish({state:next?'idle':'signed_out'});
 }
 async function read(orderId){
  if(closed||!token)return;
  const request=++revision;const sessionToken=token;
  if(typeof orderId!=='string'||!uuid.test(orderId)){publish({state:'error',code:'INVALID_REQUEST'});return;}
  publish({state:'loading'});
  // A synchronous host callback may change session, selection or dispose.
  // Do not start transport with a token captured before that invalidation.
  if(closed||request!==revision||token!==sessionToken)return;
  let result;
  try{result=await client.read({sessionToken,orderId});}catch{result={ok:false,code:'UNAVAILABLE'};}
  if(closed||request!==revision)return;
  let view;
  if(result?.ok===true){
   try{if(result.value?.orderId!==orderId)throw Error('ORDER_MISMATCH');view={state:'ready',value:presentStatus(result.value,locale)};}catch{view={state:'error',code:'UNAVAILABLE'};}
  }else{
   const code=['AUTH_REQUIRED','NOT_FOUND','INVALID_REQUEST','UNAVAILABLE'].includes(result?.code)?result.code:'UNAVAILABLE';
   view={state:'error',code};
  }
  publish(view);
 }
 return Object.freeze({setSession,read,clear(){if(!closed){revision++;publish({state:token?'idle':'signed_out'});}},dispose(){closed=true;revision++;token=null;}});
}
module.exports={presentStatus,createStatusPresentation};
