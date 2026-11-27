'use strict';
// Synthetic exact rational price. No market feed, user authentication, commercial
// fee, or authority to execute. The price and clock are trusted test inputs.
const {createHash}=require('node:crypto');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const amount=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const time=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const priceKeys=['mode','source','priceId','digitalMinor','coinMinor','observedAt','validUntil'];
const requestKeys=['eventId','quoteId','owner','direction','inputMinor','minimumOutputMinor','ttlMs'];
function buildDigitalCoinQuote({environment,price,request,now}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!time(now))fail('INVALID_CLOCK');
 if(!exact(price,priceKeys)||price.mode!=='sandbox'||price.source!=='synthetic-price-fixture'||!id(price.priceId)||
 !amount(price.digitalMinor)||!amount(price.coinMinor)||!time(price.observedAt)||!time(price.validUntil)||
 price.validUntil<=price.observedAt||price.validUntil-price.observedAt>300000)fail('INVALID_PRICE');
 if(now<price.observedAt||now>=price.validUntil)fail('STALE_PRICE');
 if(!exact(request,requestKeys)||![request.eventId,request.quoteId,request.owner].every(id)||request.owner==='treasury'||
 !['digital_to_coin','coin_to_digital'].includes(request.direction)||!amount(request.inputMinor)||!amount(request.minimumOutputMinor)||
 !Number.isSafeInteger(request.ttlMs)||request.ttlMs<1||request.ttlMs>300000)fail('INVALID_QUOTE_REQUEST');
 const forward=request.direction==='digital_to_coin';
 const numerator=BigInt(forward?price.coinMinor:price.digitalMinor);
 const denominator=BigInt(forward?price.digitalMinor:price.coinMinor);
 const product=BigInt(request.inputMinor)*numerator;
 const output=product/denominator,remainder=product%denominator;
 if(output===0n)fail('OUTPUT_TOO_SMALL');
 if(!amount(String(output)))fail('OUTPUT_LIMIT');
 if(output<BigInt(request.minimumOutputMinor))fail('MINIMUM_OUTPUT_NOT_MET');
 const expiresAt=now+Math.min(request.ttlMs,price.validUntil-now);
 const event={eventId:request.eventId,kind:'quote_created',at:now,quoteId:request.quoteId,owner:request.owner,
 direction:request.direction,digitalMinor:forward?request.inputMinor:String(output),
 coinMinor:forward?String(output):request.inputMinor,expiresAt};
 // Stable order, not JSON insertion order. A digest is not a signature.
 const priceSha256=createHash('sha256').update(JSON.stringify(priceKeys.map(k=>price[k]))).digest('hex');
 return {mode:'sandbox',priceId:price.priceId,priceSha256,quoteEvent:event,
  calculation:{inputMinor:request.inputMinor,outputMinor:String(output),rounding:'floor_output',
   discardedOutputNumerator:String(remainder),discardedOutputDenominator:String(denominator),feeMinor:'0'}};
}
function verifyDigitalCoinQuote({environment,price,request,now,quote}={}){
 const expected=buildDigitalCoinQuote({environment,price,request,now});
 const equal=(a,b)=>exact(a,Object.keys(b))&&Object.keys(b).every(k=>b[k]&&typeof b[k]==='object'?equal(a[k],b[k]):a[k]===b[k]);
 if(!equal(quote,expected))fail('QUOTE_MISMATCH');
 return expected;
}
module.exports={buildDigitalCoinQuote,verifyDigitalCoinQuote};
