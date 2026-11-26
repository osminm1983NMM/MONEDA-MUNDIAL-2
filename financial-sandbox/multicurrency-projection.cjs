'use strict';
// Isolated synthetic accounting projection, NOT a live ledger or approved accounting policy.
// Debit positive, credit negative. Never add units of different currencies.
const {createHash}=require('node:crypto');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const nonnegative=v=>Number.isSafeInteger(v)&&v>=0;
const canonical=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const accounts={USD:['provider_cash','customer_payable','fx_bridge','fee_revenue','fx_expense'],HNL:['provider_cash','fx_bridge']};
function projectMulticurrency({environment,order,events}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!order||order.mode!=='sandbox'||!id(order.id)||!positive(order.principalUsdMinor)||!nonnegative(order.feeUsdMinor)||!positive(order.payoutHnlMinor)||!Number.isSafeInteger(order.principalUsdMinor+order.feeUsdMinor)||!Array.isArray(events)||events.length>1000)fail('INVALID_INPUT');
 const principal=BigInt(order.principalUsdMinor),fee=BigInt(order.feeUsdMinor),total=principal+fee,payout=BigInt(order.payoutHnlMinor);
 const balances=Object.fromEntries(Object.entries(accounts).map(([c,keys])=>[c,Object.fromEntries(keys.map(k=>[k,0n]))]));
 const journal=[],seen=new Map();let state='awaiting_funding',duplicates=0;
 function post(eventId,currency,entries){
  if(!Object.hasOwn(balances,currency)||entries.some(([a])=>!Object.hasOwn(balances[currency],a))||entries.reduce((s,[,v])=>s+v,0n)!==0n)fail('UNBALANCED');
  const nonzero=entries.filter(([,v])=>v!==0n);
  if(!nonzero.length)return;
  for(const [a,v] of nonzero)balances[currency][a]+=v;
  journal.push({eventId,currency,entries:nonzero.map(([account,delta])=>({account,delta:String(delta)}))});
 }
 const shape={
  funding_confirmed:['usdMinor'],funding_failed:[],
  fx_acquired:['usdMinor','hnlMinor','costUsdMinor'],
  payout_confirmed:['hnlMinor'],payout_failed:[],
  fx_unwound:['usdMinor','hnlMinor','costUsdMinor'],
  refund_confirmed:['usdMinor']
 };
 for(const e of events){
  if(!e||e.mode!=='sandbox'||e.orderId!==order.id||!id(e.eventId)||typeof e.type!=='string'||!Object.hasOwn(shape,e.type))fail('INVALID_EVENT');
  const fields=shape[e.type],keys=['mode','orderId','eventId','type',...fields];
  if(Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k))||fields.some(k=>!(k==='costUsdMinor'?nonnegative:positive)(e[k])))fail('INVALID_EVENT');
  const fingerprint=canonical(keys.map(k=>e[k]));
  if(seen.has(e.eventId)){if(seen.get(e.eventId)!==fingerprint)fail('EVENT_ID_CONFLICT');duplicates++;continue;}
  const eq=(field,value)=>{if(BigInt(e[field])!==value)fail('AMOUNT_MISMATCH');};
  const requireState=(...allowed)=>{if(!allowed.includes(state))fail('INVALID_TRANSITION');};
  switch(e.type){
   case 'funding_confirmed':
    requireState('awaiting_funding');eq('usdMinor',total);
    post(e.eventId,'USD',[['provider_cash',total],['customer_payable',-total]]);
    state='funded';break;
   case 'funding_failed':
    requireState('awaiting_funding');state='funding_failed';break;
   case 'fx_acquired':{
    requireState('funded');eq('usdMinor',principal);eq('hnlMinor',payout);
    const cost=BigInt(e.costUsdMinor);
    post(e.eventId,'USD',[['fx_bridge',principal],['fx_expense',cost],['provider_cash',-principal-cost]]);
    post(e.eventId,'HNL',[['provider_cash',payout],['fx_bridge',-payout]]);
    state='fx_acquired';break;}
   case 'payout_confirmed':
    requireState('fx_acquired');eq('hnlMinor',payout);
    post(e.eventId,'HNL',[['fx_bridge',payout],['provider_cash',-payout]]);
    // Recognize synthetic fee only after confirmation. Clear USD bridge for principal.
    post(e.eventId,'USD',[['customer_payable',total],['fx_bridge',-principal],['fee_revenue',-fee]]);
    state='paid';break;
   case 'payout_failed':
    requireState('funded','fx_acquired');state=state==='funded'?'payout_failed_unconverted':'payout_failed_converted';break;
   case 'fx_unwound':{
    requireState('payout_failed_converted');eq('usdMinor',principal);eq('hnlMinor',payout);
    const cost=BigInt(e.costUsdMinor);
    post(e.eventId,'HNL',[['fx_bridge',payout],['provider_cash',-payout]]);
    post(e.eventId,'USD',[['provider_cash',principal-cost],['fx_expense',cost],['fx_bridge',-principal]]);
    state='payout_failed_unconverted';break;}
   case 'refund_confirmed':
    requireState('payout_failed_unconverted');eq('usdMinor',total);
    post(e.eventId,'USD',[['customer_payable',total],['provider_cash',-total]]);
    state='refunded';break;
  }
  seen.set(e.eventId,fingerprint);
 }
 const balanced=Object.values(balances).every(b=>Object.values(b).reduce((s,v)=>s+v,0n)===0n);
 if(!balanced)fail('UNBALANCED');
 const closing=Object.fromEntries(Object.entries(balances).map(([c,b])=>[c,Object.fromEntries(Object.entries(b).map(([k,v])=>[k,String(v)]))]));
 return {mode:'sandbox',state,balanced,duplicates,eventCount:seen.size,journal,balances:closing,
  // Negative projected cash is an unfunded cost, not permission to move money.
  cashShortfallMinor:Object.fromEntries(Object.entries(balances).map(([c,b])=>[c,String(b.provider_cash<0n?-b.provider_cash:0n)]))};
}
module.exports={projectMulticurrency};
