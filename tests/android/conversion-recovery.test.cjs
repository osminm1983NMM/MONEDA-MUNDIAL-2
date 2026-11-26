const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const c=fs.readFileSync('App.js','utf8');
const src=c.slice(c.indexOf('async function requestSwapQuote'),c.indexOf('async function recoverPendingPickup'));
test('conversion recovery retains original reference after network failure',async()=>{
 const q={quoteId:'12345678-1234-4234-8234-123456789abc'};
 let saved=null, calls=[], quote=null, fail=true;
 const storage={getItem:async()=>saved,setItem:async(k,v)=>{saved=v},removeItem:async()=>{saved=null}};
 const rpc=async(name)=>{calls.push(name);if(name.includes('quote'))return {data:q};if(name.includes('confirm'))return fail?{error:{message:'network'},status:0}:{data:{status:'already_processed'}};return {data:{}}};
 const ref={current:null};
 const fn=new Function('AsyncStorage','supabase','swapQuoteRef','setSwapQuote','userId','isCurrentUser','beginSwapBusy','endSwapBusy','swapAmount','swapFrom','uniqueRequestId','message','swapBusy','isDefinitiveRpcRejection','setSwapAmount','setSwapWallet',src+'return {requestSwapQuote,confirmSwap}');
 const api=fn(storage,{rpc},ref,v=>quote=v,'u',()=>true,()=>1,()=>{},'1','STABLE',()=>q.quoteId,()=>{},false,()=>false,()=>{},()=>{});
 await api.requestSwapQuote();await api.confirmSwap(q.quoteId);assert.ok(saved);
 ref.current=null;await api.requestSwapQuote();assert.equal(calls.filter(x=>x.includes('quote')).length,1);assert.equal(quote.quoteId,q.quoteId);
 fail=false;await api.confirmSwap(q.quoteId);assert.equal(saved,null);
});
