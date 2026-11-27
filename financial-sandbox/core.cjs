'use strict';
// Isolated, in-memory financial contract. NEVER instantiate in a customer-facing service.
const {createHash,randomUUID}=require('node:crypto');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const idOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const centsOk=v=>Number.isSafeInteger(v)&&v>=100&&v<=100000;
const copy=x=>structuredClone(x);
class SandboxFinance {
 #orders=new Map();#quotes=new Map();#requests=new Map();#events=new Map();#journal=[];#used=new Map();
 #clock;#id;#provider;#policy;#busy=new Set();
 #requireDisclosure;#disclosures=new Map();#accepted=new Map();#receipts=new Map();#fundingStarted=new Map();
 constructor({provider,policy,clock=Date.now,id=randomUUID,environment,requireDisclosure=false}){
  if(environment!=='sandbox'||provider?.mode!=='sandbox'||typeof provider.verifyEvent!=='function'||typeof provider.submit!=='function'||typeof policy!=='function')fail('SANDBOX_ONLY');
  if(typeof requireDisclosure!=='boolean')fail('INVALID_DISCLOSURE_MODE');
  this.#requireDisclosure=requireDisclosure;this.#provider=provider;this.#policy=policy;this.#clock=clock;this.#id=id;
 }
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||n<0)fail('CLOCK');return n;}
 #actor(a){if(!idOk(a))fail('AUTH_REQUIRED');}
 #order(actor,id){this.#actor(actor);const o=this.#orders.get(id);if(!o||o.actor!==actor)fail('NOT_FOUND');return o;}
 #risk(actor,amount){
  const p=this.#policy(actor);
  // Trusted server fixture, not fields accepted from the mobile client.
  if(p?.identity!=='verified'||p?.sanctions!=='clear'||p?.risk!=='allow')fail('COMPLIANCE_HOLD');
  const key=actor+':'+Math.floor(this.#now()/86400000);
  const used=this.#used.get(key)||0;
  if(!Number.isSafeInteger(p.dailyLimitCents)||p.dailyLimitCents<amount||used+amount>p.dailyLimitCents)fail('LIMIT_EXCEEDED');
  return {key,used};
 }
 quote(actor,{destination,amountCents,method}){
  this.#actor(actor);
  if(destination!=='HN'||!centsOk(amountCents)||!['bank','card'].includes(method))fail('INVALID_QUOTE');
  // Fixture pricing, never a live price or guaranteed payout rate.
  const feeCents=Math.max(100,Math.ceil(amountCents*150/10000));
  const q={id:this.#id(),actor,origin:'US',destination,method,amountCents,feeCents,totalCents:amountCents+feeCents,sourceCurrency:'USD',payoutCurrency:'HNL',payoutAmountMinor:amountCents*25,rateLabel:'SYNTHETIC_TEST_RATE',expiresAt:this.#now()+300000,mode:'sandbox'};
  if(this.#quotes.has(q.id))fail('ID_COLLISION');
  this.#quotes.set(q.id,q);return copy(q);
 }
 // A structured presentation record, not a regulatory form or proof of reading.
 presentDisclosure(actor,{quoteId,beneficiaryRef,locale}){
  this.#actor(actor);
  if(!this.#requireDisclosure)fail('DISCLOSURE_MODE_REQUIRED');
  if(!idOk(quoteId)||!idOk(beneficiaryRef)||!['es','en'].includes(locale))fail('INVALID_DISCLOSURE');
  const q=this.#quotes.get(quoteId),now=this.#now();
  if(!q||q.actor!==actor||q.used||q.expiresAt<=now)fail('QUOTE_UNAVAILABLE');
  const record={mode:'sandbox',template:'fixture-disclosure-v1',locale,quoteId,actor,beneficiaryRef,
   origin:q.origin,destination:q.destination,method:q.method,sourceCurrency:q.sourceCurrency,
   amountCents:q.amountCents,feeCents:q.feeCents,totalCents:q.totalCents,
   payoutCurrency:q.payoutCurrency,payoutAmountMinor:q.payoutAmountMinor,rateLabel:q.rateLabel,
   expiresAt:q.expiresAt,presentedAt:now};
  const sha256=hash(record);
  this.#disclosures.set(sha256,record);
  return {sha256,record:copy(record)};
 }
 create(actor,{quoteId,requestId,beneficiaryRef,disclosureSha256}){
  this.#actor(actor);
  if(!idOk(requestId)||!idOk(quoteId)||!idOk(beneficiaryRef))fail('INVALID_REQUEST');
  const key=actor+':'+requestId, fingerprint=hash(this.#requireDisclosure?[quoteId,beneficiaryRef,disclosureSha256]:[quoteId,beneficiaryRef]);
  const previous=this.#requests.get(key);
  if(previous){if(previous.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return copy(this.#order(actor,previous.orderId));}
  const q=this.#quotes.get(quoteId);
  if(!q||q.actor!==actor||q.expiresAt<=this.#now()||q.used)fail('QUOTE_UNAVAILABLE');
  let disclosure;
  if(this.#requireDisclosure){
   if(typeof disclosureSha256!=='string'||!/^[a-f0-9]{64}$/.test(disclosureSha256))fail('DISCLOSURE_REQUIRED');
   disclosure=this.#disclosures.get(disclosureSha256);
   if(!disclosure||disclosure.actor!==actor||disclosure.quoteId!==q.id||
    disclosure.beneficiaryRef!==beneficiaryRef||hash(disclosure)!==disclosureSha256)fail('DISCLOSURE_MISMATCH');
   if(disclosure.expiresAt<=this.#now())fail('QUOTE_UNAVAILABLE');
  }
  const risk=this.#risk(actor,q.totalCents);
  const o={id:this.#id(),actor,quoteId,requestId,beneficiaryRef,amountCents:q.amountCents,feeCents:q.feeCents,totalCents:q.totalCents,payoutAmountMinor:q.payoutAmountMinor,payoutCurrency:q.payoutCurrency,state:'awaiting_funding',mode:'sandbox',provider:this.#provider.id,createdAt:this.#now(),fundingRef:null,payoutRef:null,refundRef:null};
  if(this.#orders.has(o.id))fail('ID_COLLISION');
  if(disclosure){
   if(o.createdAt>=disclosure.expiresAt||o.createdAt<disclosure.presentedAt)fail('QUOTE_UNAVAILABLE');
   this.#accepted.set(o.id,{sha256:disclosureSha256,record:copy(disclosure),acceptedAt:o.createdAt});
  }
  this.#orders.set(o.id,o);this.#requests.set(key,{fingerprint,orderId:o.id});q.used=true;
  this.#used.set(risk.key,risk.used+o.totalCents);return copy(o);
 }
 get(actor,id){return copy(this.#order(actor,id));}
 getDisclosure(actor,id){this.#order(actor,id);return copy(this.#accepted.get(id)??null);}
 getReceipt(actor,id){this.#order(actor,id);return copy(this.#receipts.get(id)??null);}
 // Submit only against a known state, with stable provider reference for retries.
 // Unknown transport outcome leaves a pending reference; never assumes payment failed.
 async submit(actor,id,kind){
  const o=this.#order(actor,id);
  const rules={funding:['awaiting_funding','funding_pending','fundingRef'],payout:['funded','payout_pending','payoutRef'],refund:['payout_failed','refund_pending','refundRef']};
  const r=typeof kind==='string'&&Object.hasOwn(rules,kind)?rules[kind]:null;if(!r)fail('INVALID_ACTION');
  const [before,pending,field]=r;
  if(o.state!==before&&o.state!==pending)fail('INVALID_TRANSITION');
  if(kind==='funding'||kind==='payout'){
   const p=this.#policy(actor);if(p?.identity!=='verified'||p?.sanctions!=='clear'||p?.risk!=='allow')fail('COMPLIANCE_HOLD');
  }
  if(this.#busy.has(id))fail('IN_FLIGHT');
  // Only the initial funding intent must be within the accepted quote window.
  // A pending intent must remain recoverable even after the quote expires.
  if(this.#requireDisclosure&&kind==='funding'&&o.state===before){
   const accepted=this.#accepted.get(o.id),now=this.#now();
   if(!accepted||now<accepted.acceptedAt||now>=accepted.record.expiresAt)fail('FUNDING_QUOTE_EXPIRED');
   this.#fundingStarted.set(o.id,now);
  }
  if(!o[field])o[field]=o.id+'-'+kind;
  o.state=pending;
  this.#busy.add(id);
  try{
   await this.#provider.submit({kind,reference:o[field],orderId:o.id,currency:kind==='payout'?'HNL':'USD',amountMinor:kind==='payout'?o.payoutAmountMinor:o.totalCents,mode:'sandbox'});
  }finally{this.#busy.delete(id);}
  return copy(o);
 }
 // Authenticated provider events only; a transport acknowledgment never posts accounting.
 receive(raw,signature){
  const event=this.#provider.verifyEvent(raw,signature);
  if(!event||event.mode!=='sandbox'||event.provider!==this.#provider.id||!idOk(event.eventId)||!idOk(event.orderId))fail('INVALID_EVENT');
  const key=event.provider+':'+event.eventId, fingerprint=hash(raw);
  const prior=this.#events.get(key);
  if(prior){if(prior!==fingerprint)fail('EVENT_ID_CONFLICT');return {status:'duplicate'};}
  const o=this.#orders.get(event.orderId);if(!o)fail('UNKNOWN_ORDER');
  const rules={
   funding_confirmed:['funding_pending','funded','fundingRef','USD',o.totalCents],
   funding_failed:['funding_pending','funding_failed','fundingRef','USD',o.totalCents],
   payout_confirmed:['payout_pending','paid','payoutRef','HNL',o.payoutAmountMinor],
   payout_failed:['payout_pending','payout_failed','payoutRef','HNL',o.payoutAmountMinor],
   refund_confirmed:['refund_pending','refunded','refundRef','USD',o.totalCents]
  };
  // Reject coercible non-string types before selecting any accounting transition.
  const r=typeof event.type==='string'&&Object.hasOwn(rules,event.type)?rules[event.type]:null;
  if(!r||!o[r[2]]||event.reference!==o[r[2]]||event.currency!==r[3]||event.amountMinor!==r[4])fail('EVENT_MISMATCH');
  if(o.state!==r[0])fail('UNEXPECTED_EVENT_STATE');
  let receipt=null;
  if(this.#requireDisclosure&&event.type==='funding_confirmed'){
   const accepted=this.#accepted.get(o.id);
   const startedAt=this.#fundingStarted.get(o.id);
   if(!accepted||!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(event.timestamp)||event.timestamp<startedAt)fail('INVALID_PAYMENT_EVIDENCE');
   receipt={mode:'sandbox',kind:'funding_confirmed_not_payout',orderId:o.id,disclosureSha256:accepted.sha256,
    disclosure:copy(accepted.record),acceptedAt:accepted.acceptedAt,fundingStartedAt:startedAt,paymentAt:event.timestamp,
    provider:o.provider,paymentReference:event.reference,paymentEventId:event.eventId,paidCurrency:event.currency,paidMinor:event.amountMinor};
  }
  let posting=null;
  if(event.type==='funding_confirmed')posting=[['provider_cash',o.totalCents],['customer_payable',-o.totalCents]];
  if(event.type==='payout_confirmed')posting=[['customer_payable',o.totalCents],['provider_cash',-o.amountCents],['fee_revenue',-o.feeCents]];
  if(event.type==='refund_confirmed')posting=[['customer_payable',o.totalCents],['provider_cash',-o.totalCents]];
  if(posting){
   if(posting.reduce((s,e)=>s+e[1],0)!==0||posting.some(e=>!Number.isSafeInteger(e[1])||e[1]===0))fail('UNBALANCED');
   this.#journal.push({orderId:o.id,eventId:event.eventId,currency:'USD',entries:posting.map(([account,delta])=>({account,delta}))});
  }
  if(receipt)this.#receipts.set(o.id,receipt);
  o.state=r[1];this.#events.set(key,fingerprint);
  return {status:'applied',state:o.state};
 }
 // Internal diagnostic only. No client route, no customer identifiers or PII.
 reconcile(){
  const balances={provider_cash:0,customer_payable:0,fee_revenue:0};
  let balanced=true;
  for(const t of this.#journal){
   if(t.entries.reduce((s,e)=>s+e.delta,0)!==0)balanced=false;
   for(const e of t.entries)balances[e.account]+=e.delta;
  }
  let expectedPayable=0,expectedRevenue=0;
  for(const o of this.#orders.values()){
   if(['funded','payout_pending','payout_failed','refund_pending'].includes(o.state))expectedPayable-=o.totalCents;
   if(o.state==='paid')expectedRevenue-=o.feeCents;
  }
  return {balanced:balanced&&Object.values(balances).every(Number.isSafeInteger)&&Object.values(balances).reduce((a,b)=>a+b,0)===0,liabilityMatches:balances.customer_payable===expectedPayable,revenueMatches:balances.fee_revenue===expectedRevenue,balances,orders:this.#orders.size,postings:this.#journal.length,events:this.#events.size};
 }
}
module.exports={SandboxFinance};
