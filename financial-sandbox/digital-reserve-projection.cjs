'use strict';
// Pure fictional Digital reserve journal. One synthetic Digital minor unit = one
// synthetic USD cent. No custody, minting, network, live funds or authorization.
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const positive=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const fields={
 reserve_confirmed:['eventId','kind','amountMinor','asset','purpose'],
 issue_confirmed:['eventId','kind','amountMinor','owner'],
 redemption_reserved:['eventId','kind','amountMinor','owner','redemptionId'],
 redemption_cancelled:['eventId','kind','redemptionId'],
 burn_confirmed:['eventId','kind','redemptionId'],
 payout_confirmed:['eventId','kind','redemptionId'],
 reserve_loss:['eventId','kind','amountMinor'],
 transfer_reserved:['eventId','kind','transferId','from','to','amountMinor'],
 transfer_confirmed:['eventId','kind','transferId'],
 transfer_cancelled:['eventId','kind','transferId']
};
function projectDigitalReserve({environment,events}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!Array.isArray(events)||events.length>10000)fail('INVALID_HISTORY');
 let reserve=0n,outstanding=0n,payable=0n;
 const accounts=new Map(),redemptions=new Map(),transfers=new Map(),seen=new Map(),journal=[];
 const balance=owner=>accounts.get(owner)||{available:0n,reserved:0n};
 const posting=(eventId,asset,entries)=>{
  if(entries.reduce((sum,x)=>sum+x[1],0n)!==0n)fail('UNBALANCED_JOURNAL');
  journal.push({eventId,asset,entries:entries.map(([account,amount])=>({account,signedMinor:String(amount)}))});
 };
 for(const e of events){
  if(!e||typeof e!=='object'||Array.isArray(e)||!id(e.eventId)||!Object.hasOwn(fields,e.kind))fail('INVALID_EVENT');
  const keys=fields[e.kind];
  if(Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k)))fail('INVALID_EVENT');
  if(keys.includes('amountMinor')&&!positive(e.amountMinor))fail('INVALID_AMOUNT');
  if(keys.includes('owner')&&!id(e.owner))fail('INVALID_OWNER');
  if(keys.includes('redemptionId')&&!id(e.redemptionId))fail('INVALID_REDEMPTION_ID');
  for(const key of ['transferId','from','to'])if(keys.includes(key)&&!id(e[key]))fail('INVALID_IDENTIFIER');
  const fingerprint=JSON.stringify(keys.map(k=>e[k]));
  if(seen.has(e.eventId)){
   if(seen.get(e.eventId)!==fingerprint)fail('EVENT_ID_CONFLICT');
   continue;
  }
  const n=keys.includes('amountMinor')?BigInt(e.amountMinor):0n;
  if(e.kind==='reserve_confirmed'){
   if(e.asset!=='USD' || e.purpose!=='digital_reserve')fail('INELIGIBLE_RESERVE');
   reserve+=n;posting(e.eventId,'USD',[['reserve_cash',n],['reserve_funding_clearing',-n]]);
  }else if(e.kind==='reserve_loss'){
   if(n>reserve)fail('INSUFFICIENT_RESERVE');
   reserve-=n;posting(e.eventId,'USD',[['reserve_loss',n],['reserve_cash',-n]]);
  }else if(e.kind==='issue_confirmed'){
   if(reserve<outstanding+payable+n)fail('INSUFFICIENT_COVERAGE');
   const b=balance(e.owner);b.available+=n;accounts.set(e.owner,b);
   outstanding+=n;
   posting(e.eventId,'DIGITAL_TEST',[['issuance_control',n],['available:'+e.owner,-n]]);
   posting(e.eventId,'USD',[['issuance_clearing',n],['digital_obligation',-n]]);
  }else if(e.kind==='transfer_reserved'){
   if(e.from===e.to)fail('SAME_ACCOUNT');
   if(transfers.has(e.transferId))fail('TRANSFER_ID_CONFLICT');
   if(reserve<outstanding+payable)fail('INSUFFICIENT_COVERAGE');
   const b=balance(e.from);if(b.available<n)fail('INSUFFICIENT_AVAILABLE');
   b.available-=n;b.reserved+=n;accounts.set(e.from,b);
   transfers.set(e.transferId,{from:e.from,to:e.to,amount:n,state:'reserved'});
   posting(e.eventId,'DIGITAL_TEST',[['available:'+e.from,n],['reserved:'+e.from,-n]]);
  }else if(e.kind==='transfer_confirmed'||e.kind==='transfer_cancelled'){
   const x=transfers.get(e.transferId);if(!x)fail('TRANSFER_NOT_FOUND');
   if(x.state!=='reserved')fail('INVALID_TRANSITION');
   const b=balance(x.from),v=x.amount;b.reserved-=v;
   if(e.kind==='transfer_cancelled'){
    b.available+=v;x.state='cancelled';
    posting(e.eventId,'DIGITAL_TEST',[['reserved:'+x.from,v],['available:'+x.from,-v]]);
   }else{
    const receiver=balance(x.to);receiver.available+=v;accounts.set(x.to,receiver);
    x.state='confirmed';
    posting(e.eventId,'DIGITAL_TEST',[['reserved:'+x.from,v],['available:'+x.to,-v]]);
   }
  }else if(e.kind==='redemption_reserved'){
   if(redemptions.has(e.redemptionId))fail('REDEMPTION_ID_CONFLICT');
   const b=balance(e.owner);if(b.available<n)fail('INSUFFICIENT_AVAILABLE');
   b.available-=n;b.reserved+=n;accounts.set(e.owner,b);
   redemptions.set(e.redemptionId,{owner:e.owner,amount:n,state:'reserved'});
   posting(e.eventId,'DIGITAL_TEST',[['available:'+e.owner,n],['reserved:'+e.owner,-n]]);
  }else{
   const x=redemptions.get(e.redemptionId);if(!x)fail('REDEMPTION_NOT_FOUND');
   const b=balance(x.owner),v=x.amount;
   if(e.kind==='redemption_cancelled'){
    if(x.state!=='reserved')fail('INVALID_TRANSITION');
    b.reserved-=v;b.available+=v;x.state='cancelled';
    posting(e.eventId,'DIGITAL_TEST',[['reserved:'+x.owner,v],['available:'+x.owner,-v]]);
   }else if(e.kind==='burn_confirmed'){
    if(x.state!=='reserved')fail('INVALID_TRANSITION');
    b.reserved-=v;outstanding-=v;payable+=v;x.state='awaiting_payout';
    posting(e.eventId,'DIGITAL_TEST',[['reserved:'+x.owner,v],['issuance_control',-v]]);
    posting(e.eventId,'USD',[['digital_obligation',v],['redemption_payable',-v]]);
   }else{
    if(x.state!=='awaiting_payout')fail('INVALID_TRANSITION');
    if(reserve<v)fail('INSUFFICIENT_RESERVE');
    // This records a fictional payout already confirmed; not a request to send.
    reserve-=v;payable-=v;x.state='paid';
    posting(e.eventId,'USD',[['redemption_payable',v],['reserve_cash',-v]]);
   }
  }
  seen.set(e.eventId,fingerprint);
 }
 const obligations=outstanding+payable;
 const sum=[...accounts.values()].reduce((s,b)=>s+b.available+b.reserved,0n);
 const waiting=[...redemptions.values()].filter(x=>x.state==='awaiting_payout').reduce((s,x)=>s+x.amount,0n);
 const pending=new Map();
 for(const x of redemptions.values())if(x.state==='reserved')pending.set(x.owner,(pending.get(x.owner)||0n)+x.amount);
 for(const x of transfers.values())if(x.state==='reserved')pending.set(x.from,(pending.get(x.from)||0n)+x.amount);
 if(sum!==outstanding||waiting!==payable||[...accounts].some(([owner,b])=>b.available<0n||b.reserved<0n||b.reserved!==(pending.get(owner)||0n)))fail('INVARIANT_VIOLATION');
 return {mode:'sandbox',reserveUsdMinor:String(reserve),outstandingDigitalMinor:String(outstanding),
  redemptionPayableUsdMinor:String(payable),obligationsUsdMinor:String(obligations),
  coverageSufficient:reserve>=obligations,shortfallUsdMinor:String(reserve<obligations?obligations-reserve:0n),
  accounts:[...accounts].map(([owner,b])=>({owner,available:String(b.available),reserved:String(b.reserved)})),
  transfers:[...transfers].map(([transferId,x])=>({transferId,from:x.from,to:x.to,amountMinor:String(x.amount),state:x.state})),
  redemptions:[...redemptions].map(([redemptionId,x])=>({redemptionId,owner:x.owner,amountMinor:String(x.amount),state:x.state})),journal};
}
module.exports={projectDigitalReserve};
