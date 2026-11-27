'use strict';
// Independent synthetic Coin unit journal. No pricing, real token, chain or custody.
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const positive=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const shape={
 mint_confirmed:['eventId','kind','amountMinor'],
 transfer_reserved:['eventId','kind','transferId','from','to','amountMinor'],
 transfer_confirmed:['eventId','kind','transferId'],
 transfer_cancelled:['eventId','kind','transferId'],
 burn_confirmed:['eventId','kind','owner','amountMinor']
};
function projectCoinUnits({environment,capMinor,events}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!positive(capMinor))fail('INVALID_FIXTURE_CAP');
 if(!Array.isArray(events)||events.length>10000)fail('INVALID_HISTORY');
 const cap=BigInt(capMinor),treasury='treasury';
 let minted=0n,burned=0n;
 const accounts=new Map(),transfers=new Map(),seen=new Map(),journal=[];
 function balance(owner){
  if(!accounts.has(owner))accounts.set(owner,{available:0n,reserved:0n});
  return accounts.get(owner);
 }
 function post(eventId,entries){
  if(entries.reduce((s,x)=>s+x[1],0n)!==0n)fail('UNBALANCED_JOURNAL');
  journal.push({eventId,asset:'COIN_TEST',entries:entries.map(([account,n])=>({account,signedMinor:String(n)}))});
 }
 for(const e of events){
  if(!e||typeof e!=='object'||Array.isArray(e)||!id(e.eventId)||typeof e.kind!=='string'||!Object.hasOwn(shape,e.kind))fail('INVALID_EVENT');
  const keys=shape[e.kind];
  if(Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k)))fail('INVALID_EVENT');
  if(keys.includes('amountMinor')&&!positive(e.amountMinor))fail('INVALID_AMOUNT');
  for(const key of ['transferId','from','to','owner'])if(keys.includes(key)&&!id(e[key]))fail('INVALID_IDENTIFIER');
  const fingerprint=JSON.stringify(keys.map(k=>e[k]));
  if(seen.has(e.eventId)){
   if(seen.get(e.eventId)!==fingerprint)fail('EVENT_ID_CONFLICT');
   continue;
  }
  const n=keys.includes('amountMinor')?BigInt(e.amountMinor):0n;
  if(e.kind==='mint_confirmed'){
   // Conservative test policy: lifetime issuance, not outstanding units, is capped.
   if(minted+n>cap)fail('FIXTURE_CAP_EXCEEDED');
   minted+=n;balance(treasury).available+=n;
   post(e.eventId,[['issuance_control',n],['available:'+treasury,-n]]);
  }else if(e.kind==='burn_confirmed'){
   const b=balance(e.owner);
   if(b.available<n)fail('INSUFFICIENT_AVAILABLE');
   b.available-=n;burned+=n;
   post(e.eventId,[['available:'+e.owner,n],['issuance_control',-n]]);
  }else if(e.kind==='transfer_reserved'){
   if(e.from===e.to)fail('SAME_ACCOUNT');
   if(transfers.has(e.transferId))fail('TRANSFER_ID_CONFLICT');
   const b=balance(e.from);
   if(b.available<n)fail('INSUFFICIENT_AVAILABLE');
   b.available-=n;b.reserved+=n;
   transfers.set(e.transferId,{from:e.from,to:e.to,amount:n,state:'reserved'});
   post(e.eventId,[['available:'+e.from,n],['reserved:'+e.from,-n]]);
  }else{
   const x=transfers.get(e.transferId);
   if(!x)fail('TRANSFER_NOT_FOUND');
   if(x.state!=='reserved')fail('INVALID_TRANSITION');
   const b=balance(x.from),v=x.amount;
   b.reserved-=v;
   if(e.kind==='transfer_cancelled'){
    b.available+=v;x.state='cancelled';
    post(e.eventId,[['reserved:'+x.from,v],['available:'+x.from,-v]]);
   }else{
    balance(x.to).available+=v;x.state='confirmed';
    post(e.eventId,[['reserved:'+x.from,v],['available:'+x.to,-v]]);
   }
  }
  seen.set(e.eventId,fingerprint);
 }
 const outstanding=minted-burned;
 const supply=[...accounts.values()].reduce((s,b)=>s+b.available+b.reserved,0n);
 const pendingByOwner=new Map();
 for(const x of transfers.values())if(x.state==='reserved')pendingByOwner.set(x.from,(pendingByOwner.get(x.from)||0n)+x.amount);
 if(supply!==outstanding||minted>cap||burned>minted||[...accounts].some(([owner,b])=>b.available<0n||b.reserved<0n||b.reserved!==(pendingByOwner.get(owner)||0n)))fail('INVARIANT_VIOLATION');
 const t=accounts.get(treasury),treasuryUnits=t?t.available+t.reserved:0n;
 return {mode:'sandbox',asset:'COIN_TEST',fixtureCapMinor:capMinor,mintedMinor:String(minted),burnedMinor:String(burned),
  outstandingMinor:String(outstanding),remainingIssuanceMinor:String(cap-minted),
  treasuryMinor:String(treasuryUnits),nonTreasuryMinor:String(outstanding-treasuryUnits),
  accounts:[...accounts].map(([owner,b])=>({owner,available:String(b.available),reserved:String(b.reserved)})),
  transfers:[...transfers].map(([transferId,x])=>({transferId,from:x.from,to:x.to,amountMinor:String(x.amount),state:x.state})),journal};
}
module.exports={projectCoinUnits};
