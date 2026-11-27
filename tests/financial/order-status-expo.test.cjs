'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createExpoOrderStatusClient:create}=require('../../financial-sandbox/mobile/order-status-expo.js');
const {createOrderStatusHttp}=require('../../financial-sandbox/order-status-http.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const input={orderId,sessionToken:'fixture-token'};
const value={mode:'sandbox',orderId,status:'paid',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
const cfg={environment:'sandbox',enabled:true,sandboxOrigin:'https://sandbox.invalid'};
const headers={'content-type':'application/json','cache-control':'no-store'};
test('mobile transport requires explicit sandbox activation and injected Expo fetch',()=>{
 for(const patch of [{enabled:false},{environment:'production'},{expoFetch:undefined},{sandboxOrigin:'http://sandbox.invalid'}])
  a.throws(()=>create({...cfg,expoFetch:()=>{},...patch}));
});
test('transport contract connects to real handler in memory with no cookies or redirects',async()=>{
 const handler=createOrderStatusHttp({environment:'sandbox',service:{async read(x){a.deepEqual(x,input);return {status:200,body:value};}}});
 const client=create({...cfg,expoFetch:(url,init)=>{
  a.equal(init.redirect,'error');a.equal(init.credentials,'omit');a.equal(init.signal.aborted,false);
  return handler(new Request(url,init));
 }});
 a.deepEqual(await client.read(input),{ok:true,value});
});
test('bounded portable decoding supports split chunks, rejects non-ASCII and excess bytes',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 const make=parts=>create({...cfg,expoFetch:()=>new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(p);c.close();}}),{headers})});
 a.deepEqual(await make([bytes.slice(0,7),bytes.slice(7)]).read(input),{ok:true,value});
 for(const parts of [[new Uint8Array([255])],[new Uint8Array(8193)]])a.deepEqual(await make(parts).read(input),{ok:false,code:'UNAVAILABLE'});
});
