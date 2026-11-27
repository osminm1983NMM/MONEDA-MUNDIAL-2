'use strict';
// Pure joint projection, not a transaction service or market maker. All quotes,
// times and starting inventories are trusted synthetic fixtures. No fees here.
const {projectDigitalReserve}=require('./digital-reserve-projection.cjs');
const {projectCoinUnits}=require('./coin-unit-projection.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const amount=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const time=v=>Number.isSafeInteger(v)&&v>=0;
const market='treasury';
const shapes={
 quote_created:['eventId','kind','at','quoteId','owner','direction','digitalMinor','coinMinor','expiresAt'],
 quote_accepted:['eventId','kind','at','quoteId','owner'],
 swap_confirmed:['eventId','kind','at','quoteId'],
 swap_cancelled:['eventId','kind','at','quoteId']
};
function projectDigitalCoinSwaps({environment,capMinor,digitalEvents=[],coinEvents=[],events}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!Array.isArray(events)||events.length>2000||![digitalEvents,coinEvents].every(x=>Array.isArray(x)&&x.length<=8000))fail('INVALID_HISTORY');
 for(const e of [...digitalEvents,...coinEvents])
  if(!e||[e.eventId,e.transferId].some(v=>typeof v==='string'&&v.startsWith('swap-')))fail('RESERVED_NAMESPACE');
 const digital=[...digitalEvents],coin=[...coinEvents],seen=new Map(),quotes=new Map();
 // Validate the base even if there are no conversions.
 const initial=projectDigitalReserve({environment,events:digital});
 projectCoinUnits({environment,capMinor,events:coin});
 let last=-1;
 for(const e of events){
  if(!e||typeof e!=='object'||Array.isArray(e)||!id(e.eventId)||!id(e.quoteId)||typeof e.kind!=='string'||!Object.hasOwn(shapes,e.kind)||!time(e.at))fail('INVALID_SWAP_EVENT');
  const keys=shapes[e.kind];
  if(Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k)))fail('INVALID_SWAP_EVENT');
  const fp=JSON.stringify(keys.map(k=>e[k]));
  if(seen.has(e.eventId)){if(seen.get(e.eventId)!==fp)fail('EVENT_ID_CONFLICT');continue;}
  if(e.at<last)fail('NONMONOTONIC_TIME');last=e.at;
  if(e.kind==='quote_created'){
   if(quotes.has(e.quoteId))fail('QUOTE_ID_CONFLICT');
   if(!id(e.owner)||e.owner===market||!['digital_to_coin','coin_to_digital'].includes(e.direction)||
    !amount(e.digitalMinor)||!amount(e.coinMinor)||!time(e.expiresAt)||e.expiresAt<=e.at||e.expiresAt-e.at>300000)fail('INVALID_QUOTE');
   quotes.set(e.quoteId,{owner:e.owner,direction:e.direction,digitalMinor:e.digitalMinor,coinMinor:e.coinMinor,expiresAt:e.expiresAt,state:'quoted'});
  }else{
   const q=quotes.get(e.quoteId);if(!q)fail('QUOTE_NOT_FOUND');
   const transferId='swap-'+e.quoteId;
   if(e.kind==='quote_accepted'){
    if(q.state!=='quoted')fail('QUOTE_CONSUMED');
    if(e.owner!==q.owner)fail('OWNER_MISMATCH');
    if(e.at>=q.expiresAt)fail('QUOTE_EXPIRED');
    if(!initial.coverageSufficient)fail('INSUFFICIENT_COVERAGE');
    const digitalFrom=q.direction==='digital_to_coin'?q.owner:market;
    const digitalTo=digitalFrom===market?q.owner:market;
    digital.push({eventId:transferId+'-hold',kind:'transfer_reserved',transferId,from:digitalFrom,to:digitalTo,amountMinor:q.digitalMinor});
    coin.push({eventId:transferId+'-hold',kind:'transfer_reserved',transferId,from:digitalTo,to:digitalFrom,amountMinor:q.coinMinor});
    q.state='reserved';
   }else{
    if(q.state!=='reserved')fail('INVALID_SWAP_TRANSITION');
    const confirmed=e.kind==='swap_confirmed';
    const entry={eventId:transferId+(confirmed?'-confirm':'-cancel'),kind:confirmed?'transfer_confirmed':'transfer_cancelled',transferId};
    digital.push(entry);coin.push({...entry});
    q.state=confirmed?'confirmed':'cancelled';
   }
  }
  seen.set(e.eventId,fp);
 }
 // No side effects or partial result: either both histories validate, or the
 // entire projection throws. This does not establish durable atomicity.
 const digitalResult=projectDigitalReserve({environment,events:digital});
 const coinResult=projectCoinUnits({environment,capMinor,events:coin});
 return {mode:'sandbox',digital:digitalResult,coin:coinResult,
  quotes:[...quotes].map(([quoteId,q])=>({quoteId,...q}))};
}
module.exports={projectDigitalCoinSwaps};
