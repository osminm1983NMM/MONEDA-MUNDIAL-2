'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {buildDigitalCoinQuote:build,verifyDigitalCoinQuote:verify}=require('../../financial-sandbox/digital-coin-pricing.cjs');
const {projectDigitalCoinSwaps:project}=require('../../financial-sandbox/digital-coin-swap-projection.cjs');
const price={mode:'sandbox',source:'synthetic-price-fixture',priceId:'p1',digitalMinor:'2',coinMinor:'3',observedAt:100,validUntil:200};
const request={eventId:'q1',quoteId:'q1',owner:'alice',direction:'digital_to_coin',inputMinor:'201',minimumOutputMinor:'301',ttlMs:100};
const options={environment:'sandbox',price,request,now:110};
const run=(patch={})=>build({...options,...patch});
test('exact conversion in both directions, floor output and disclose remainder',()=>{
 const q=run();a.equal(q.quoteEvent.digitalMinor,'201');a.equal(q.quoteEvent.coinMinor,'301');
 a.equal(q.quoteEvent.expiresAt,200);
 a.deepEqual(q.calculation,{inputMinor:'201',outputMinor:'301',rounding:'floor_output',discardedOutputNumerator:'1',discardedOutputDenominator:'2',feeMinor:'0'});
 const reverse=run({request:{...request,direction:'coin_to_digital',inputMinor:'301',minimumOutputMinor:'200',ttlMs:10}});
 a.equal(reverse.quoteEvent.digitalMinor,'200');a.equal(reverse.quoteEvent.coinMinor,'301');a.equal(reverse.quoteEvent.expiresAt,120);
 a.equal(reverse.calculation.discardedOutputNumerator,'2');
});
test('future, expired and overly long price observations fail closed',()=>{
 for(const now of [99,200,201])a.throws(()=>run({now}),/STALE_PRICE/);
 a.throws(()=>run({price:{...price,validUntil:300101}}),/INVALID_PRICE/);
 a.throws(()=>run({price:{...price,source:'market'}}),/INVALID_PRICE/);
 a.throws(()=>run({request:{...request,ttlMs:300001}}),/INVALID_QUOTE_REQUEST/);
});
test('minimum output, dust, oversized outputs and malformed money are rejected',()=>{
 a.throws(()=>run({request:{...request,minimumOutputMinor:'302'}}),/MINIMUM_OUTPUT_NOT_MET/);
 a.throws(()=>run({price:{...price,digitalMinor:'1000',coinMinor:'1'},request:{...request,inputMinor:'1'}}),/OUTPUT_TOO_SMALL/);
 a.throws(()=>run({price:{...price,digitalMinor:'1',coinMinor:'999999999999999999'},request:{...request,inputMinor:'2'}}),/OUTPUT_LIMIT/);
 for(const inputMinor of [201,'01','0','1.5','1e3','-1'])a.throws(()=>run({request:{...request,inputMinor}}),/INVALID_QUOTE_REQUEST/);
 a.throws(()=>run({environment:'production'}),/SANDBOX_ONLY/);
});
test('large exact integer values do not pass through floating point',()=>{
 const q=run({price:{...price,digitalMinor:'1',coinMinor:'1'},request:{...request,inputMinor:'9007199254740993'}});
 a.equal(q.calculation.outputMinor,'9007199254740993');
});
test('verification recomputes price, owner, amounts and expiry instead of trusting output',()=>{
 const q=run();a.deepEqual(verify({...options,quote:q}),q);
 for(const patch of [{owner:'bob'},{coinMinor:'302'},{expiresAt:201}])
 a.throws(()=>verify({...options,quote:{...q,quoteEvent:{...q.quoteEvent,...patch}}}),/QUOTE_MISMATCH/);
 a.throws(()=>verify({...options,quote:{...q,priceSha256:'0'.repeat(64)}}),/QUOTE_MISMATCH/);
 const reordered=Object.fromEntries(Object.entries(price).reverse());
 a.equal(run({price:reordered}).priceSha256,q.priceSha256);
});
test('generated quote is compatible with joint projection and preserves supplies',()=>{
 const q=run().quoteEvent;
 const x=project({environment:'sandbox',capMinor:'1000',
 digitalEvents:[{eventId:'f',kind:'reserve_confirmed',amountMinor:'1000',asset:'USD',purpose:'digital_reserve'},{eventId:'i',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'}],
 coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}],
 events:[q,{eventId:'a',kind:'quote_accepted',at:111,quoteId:q.quoteId,owner:'alice'},{eventId:'c',kind:'swap_confirmed',at:112,quoteId:q.quoteId}]});
 a.equal(x.digital.accounts.find(x=>x.owner==='alice').available,'799');
 a.equal(x.coin.accounts.find(x=>x.owner==='alice').available,'301');
 a.equal(x.digital.obligationsUsdMinor,'1000');a.equal(x.coin.outstandingMinor,'1000');
});
