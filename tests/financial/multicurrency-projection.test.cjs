'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {projectMulticurrency}=require('../../financial-sandbox/multicurrency-projection.cjs');
const order={mode:'sandbox',id:'order-1',principalUsdMinor:10000,feeUsdMinor:150,payoutHnlMinor:250000};
const event=(eventId,type,fields={})=>({mode:'sandbox',orderId:order.id,eventId,type,...fields});
const funding=event('funding','funding_confirmed',{usdMinor:10150});
const fx=event('fx','fx_acquired',{usdMinor:10000,hnlMinor:250000,costUsdMinor:40});
const payout=event('payout','payout_confirmed',{hnlMinor:250000});
const failed=event('failed','payout_failed');
const unwind=event('unwind','fx_unwound',{usdMinor:10000,hnlMinor:250000,costUsdMinor:20});
const refund=event('refund','refund_confirmed',{usdMinor:10150});
const run=(events,o=order)=>projectMulticurrency({environment:'sandbox',order:o,events});
function balanced(r){a.equal(r.balanced,true);for(const j of r.journal)a.equal(j.entries.reduce((s,e)=>s+BigInt(e.delta),0n),0n);for(const b of Object.values(r.balances))a.equal(Object.values(b).reduce((s,v)=>s+BigInt(v),0n),0n);}
test('funding and FX keep each currency independent and preserve liability until payout',()=>{
 const x=run([funding,fx]);balanced(x);a.equal(x.state,'fx_acquired');
 a.deepEqual(x.balances.USD,{provider_cash:'110',customer_payable:'-10150',fx_bridge:'10000',fee_revenue:'0',fx_expense:'40'});
 a.deepEqual(x.balances.HNL,{provider_cash:'250000',fx_bridge:'-250000'});
});
test('payout clears both FX bridges, recognizes fee and separately records cost',()=>{
 const x=run([funding,fx,payout]);balanced(x);a.equal(x.state,'paid');
 a.deepEqual(x.balances.USD,{provider_cash:'110',customer_payable:'0',fx_bridge:'0',fee_revenue:'-150',fx_expense:'40'});
 a.deepEqual(x.balances.HNL,{provider_cash:'0',fx_bridge:'0'});
});
test('failure after FX requires unwind before full refund; unfunded costs remain visible',()=>{
 a.throws(()=>run([funding,fx,failed,refund]),/INVALID_TRANSITION/);
 const x=run([funding,fx,failed,unwind,refund]);balanced(x);a.equal(x.state,'refunded');
 a.deepEqual(x.balances.USD,{provider_cash:'-60',customer_payable:'0',fx_bridge:'0',fee_revenue:'0',fx_expense:'60'});
 a.deepEqual(x.cashShortfallMinor,{USD:'60',HNL:'0'});a.deepEqual(x.balances.HNL,{provider_cash:'0',fx_bridge:'0'});
});
test('no FX purchase permits complete refund without fee revenue; failed funding posts nothing',()=>{
 const x=run([funding,failed,refund]);balanced(x);a.equal(x.state,'refunded');a.ok(Object.values(x.balances.USD).every(v=>v==='0'));
 const y=run([event('declined','funding_failed')]);a.equal(y.state,'funding_failed');a.equal(y.journal.length,0);
});
test('duplicate event is a no-op, changed event or mismatched amount is rejected',()=>{
 const x=run([funding,fx,payout,{...fx}]);a.equal(x.duplicates,1);a.deepEqual(x.journal,run([funding,fx,payout]).journal);
 a.throws(()=>run([funding,fx,{...fx,costUsdMinor:41}]),/EVENT_ID_CONFLICT/);
 for(const events of [[{...funding,usdMinor:10149}],[funding,{...fx,hnlMinor:250001}],[funding,fx,{...payout,hnlMinor:249999}],[funding,fx,failed,unwind,{...refund,usdMinor:10000}]])a.throws(()=>run(events),/AMOUNT_MISMATCH/);
});
test('invalid transition, noninteger, unknown field and production fail closed',()=>{
 for(const events of [[payout],[funding,fx,payout,refund],[funding,{...fx,costUsdMinor:1.5}],[{...funding,secret:'x'}],[{...funding,type:['funding_confirmed']}],[{...funding,orderId:'other'}]])a.throws(()=>run(events));
 a.throws(()=>projectMulticurrency({environment:'production',order,events:[]}),/SANDBOX_ONLY/);
 a.throws(()=>run([],{...order,principalUsdMinor:Number.MAX_SAFE_INTEGER}),/INVALID_INPUT/);
});
