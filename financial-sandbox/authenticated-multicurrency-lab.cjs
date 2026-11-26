'use strict';
// Synthetic HMAC envelope for the offline multicurrency ledger. Not a real provider protocol.
const {createHmac,timingSafeEqual}=require('node:crypto');
const {openMulticurrencyLedger}=require('./multicurrency-ledger.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const own=(o,k)=>Object.hasOwn(o,k);
function openAuthenticatedMulticurrencyLab({environment,path,initialize=false,secret,clock=Date.now}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof secret!=='string'||Buffer.byteLength(secret)<32||typeof clock!=='function')fail('TEST_SECRET_REQUIRED');
 const ledger=openMulticurrencyLedger({environment,path,initialize});
 const sign=raw=>createHmac('sha256',secret).update('mwd:synthetic-multicurrency:v1\n').update(raw).digest('hex');
 function receive({raw,signature}={}){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>16384||typeof signature!=='string'||!/^[0-9a-f]{64}$/.test(signature))fail('INVALID_SIGNATURE');
  if(!timingSafeEqual(Buffer.from(sign(raw),'hex'),Buffer.from(signature,'hex')))fail('INVALID_SIGNATURE');
  let e;
  try{e=JSON.parse(raw);}catch{fail('INVALID_ENVELOPE');}
  if(!e||Array.isArray(e)||Object.keys(e).length!==4||!['mode','provider','timestamp','event'].every(k=>own(e,k))||e.mode!=='sandbox'||e.provider!=='mock-multicurrency'||!e.event||typeof e.event!=='object'||Array.isArray(e.event))fail('INVALID_ENVELOPE');
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)fail('CLOCK');
  if(!Number.isSafeInteger(e.timestamp)||e.timestamp<0||Math.abs(now-e.timestamp)>300000)fail('EVENT_EXPIRED');
  // Ledger validates the exact event shape and applies deduplication, state and
  // balance projection in one transaction. No direct append in this interface.
  return ledger.append(e.event.orderId,e.event);
 }
 return Object.freeze({
  create:order=>ledger.create(order),
  receive,
  get:orderId=>ledger.get(orderId),
  counts:()=>ledger.counts(),
  close:()=>ledger.close()
 });
}
module.exports={openAuthenticatedMulticurrencyLab};
