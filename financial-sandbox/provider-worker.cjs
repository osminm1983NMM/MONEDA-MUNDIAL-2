'use strict';
// Offline synthetic worker; never import into mobile or live service.
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const types=new Set(['funding','payout','refund']);
function intentOk(i){return i&&i.mode==='sandbox'&&id(i.orderId)&&id(i.reference)&&types.has(i.kind)&&i.reference===i.orderId+'-'+i.kind&&i.currency===(i.kind==='payout'?'HNL':'USD')&&Number.isSafeInteger(i.amountMinor)&&i.amountMinor>0;}
function same(a,b){return intentOk(a)&&intentOk(b)&&['orderId','reference','kind','currency','amountMinor'].every(k=>a[k]===b[k]);}
function createWorker({environment,store,provider}){
 if(environment!=='sandbox'||provider?.mode!=='sandbox'||provider.id!=='mock-remittance'||!['claim','checkLease','ack','record'].every(k=>typeof store?.[k]==='function')||!['lookup','submit','verifyEvent'].every(k=>typeof provider[k]==='function'))fail('SANDBOX_ONLY');
 return {
  async tick(){
   const lease=await store.claim();if(!lease)return {status:'idle'};
   const {intent:claimed,token}=lease;
   if(!intentOk(claimed)||!id(token)||!Number.isSafeInteger(lease.attempt)||lease.attempt<1)fail('INVALID_LEASE');
   // Preserve the exact authorized payload across asynchronous provider and lease checks.
   const intent=Object.freeze({mode:claimed.mode,orderId:claimed.orderId,reference:claimed.reference,kind:claimed.kind,currency:claimed.currency,amountMinor:claimed.amountMinor});
   if(!intentOk(intent))fail('INVALID_LEASE');
   // Lookup before every send. Unknown or conflicting status never triggers submission.
   const known=await provider.lookup(intent.reference);
   if(!known||!['absent','accepted','unknown','awaiting_confirmation'].includes(known.status))fail('INVALID_LOOKUP');
   if(known.status==='unknown')return {status:'provider_uncertain'};
   if(known.status!=='absent'&&!same(intent,known.intent))fail('PROVIDER_REFERENCE_CONFLICT');
   let needsConfirmation=known.status==='awaiting_confirmation';
   if(needsConfirmation&&(intent.kind!=='payout'||typeof provider.confirmPayout!=='function'))fail('INVALID_LOOKUP');
   if((await store.checkLease(intent.reference,token))!==true)return {status:'held'};
   if(known.status==='absent'){
    const response=await provider.submit(intent);
    if(response?.reference!==intent.reference)fail('AMBIGUOUS_ACK');
    needsConfirmation=response.status==='awaiting_confirmation';
    if(needsConfirmation){
     if(intent.kind!=='payout'||typeof provider.confirmPayout!=='function'||response.accepted!==false)fail('AMBIGUOUS_ACK');
     // Creation may have taken long enough for the original lease to lapse.
     if((await store.checkLease(intent.reference,token))!==true)return {status:'held'};
    } else if(response.accepted!==true||response.status!==undefined)fail('AMBIGUOUS_ACK');
   }
   if(needsConfirmation){
    const response=await provider.confirmPayout(intent);
    if(response?.accepted!==true||response.reference!==intent.reference||response.status!==undefined)fail('AMBIGUOUS_ACK');
   }
   await store.ack(intent.reference,token);
   return {status:'transport_acknowledged',reference:intent.reference};
  },
  async receive(raw,signature){
   const e=provider.verifyEvent(raw,signature);
   if(!e||e.provider!==provider.id||e.mode!=='sandbox'||!id(e.eventId)||!id(e.orderId)||!Number.isSafeInteger(e.amountMinor)||e.amountMinor<=0)fail('INVALID_EVENT');
   const m=typeof e.type==='string'&&/^(funding|payout|refund)_(confirmed|failed)$/.exec(e.type);
   if(!m||!id(e.reference)||e.reference!==e.orderId+'-'+m[1]||e.currency!==(m[1]==='payout'?'HNL':'USD'))fail('INVALID_EVENT');
   // Event authorization is distinct from transport acknowledgment.
   return store.record({provider:e.provider,eventId:e.eventId,reference:e.reference,outcome:m[2],currency:e.currency,amountMinor:e.amountMinor});
  }
 };
}
module.exports={createWorker};
