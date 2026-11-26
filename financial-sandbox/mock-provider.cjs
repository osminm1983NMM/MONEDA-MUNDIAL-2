'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
// This adapter has no network transport and accepts only synthetic events.
function createMockProvider({secret,clock=Date.now}){
 if(typeof secret!=='string'||secret.length<32)throw Error('TEST_SECRET_REQUIRED');
 const submissions=new Map();let loseNext=false;
 const sign=raw=>createHmac('sha256',secret).update(raw).digest('hex');
 return {
  id:'mock-remittance',mode:'sandbox',
  async submit(input){
   if(input.mode!=='sandbox')throw Error('SANDBOX_ONLY');
   const old=submissions.get(input.reference);
   if(old&&JSON.stringify(old)!==JSON.stringify(input))throw Error('PROVIDER_IDEMPOTENCY_CONFLICT');
   submissions.set(input.reference,structuredClone(input));
   if(loseNext){loseNext=false;throw Error('SIMULATED_RESPONSE_LOSS');}
   return {accepted:true,reference:input.reference};
  },
  async lookup(reference){
   const input=submissions.get(reference);
   return input?{status:'accepted',intent:structuredClone(input)}:{status:'absent'};
  },
  loseNextResponse(){loseNext=true;},
  submissions(){return [...submissions.values()].map(x=>structuredClone(x));},
  event(reference,type,eventId,patch={}){
   const s=submissions.get(reference);if(!s)throw Error('UNKNOWN_REFERENCE');
   const timestamp=clock();if(!Number.isSafeInteger(timestamp)||timestamp<0)throw Error('CLOCK');
   const raw=JSON.stringify({mode:'sandbox',provider:'mock-remittance',eventId,orderId:s.orderId,reference,type,currency:s.currency,amountMinor:s.amountMinor,timestamp,...patch});
   return {raw,signature:sign(raw)};
  },
  verifyEvent(raw,signature){
   if(typeof raw!=='string'||Buffer.byteLength(raw)>16384||typeof signature!=='string'||!/^[0-9a-f]{64}$/.test(signature))throw Error('INVALID_SIGNATURE');
   if(!timingSafeEqual(Buffer.from(sign(raw),'hex'),Buffer.from(signature,'hex')))throw Error('INVALID_SIGNATURE');
   const e=JSON.parse(raw);
   const now=clock();if(!Number.isSafeInteger(now)||now<0)throw Error('CLOCK');if(!Number.isSafeInteger(e?.timestamp)||e.timestamp<0||Math.abs(now-e.timestamp)>300000)throw Error('EVENT_EXPIRED');
   return e;
  }
 };
}
module.exports={createMockProvider};
