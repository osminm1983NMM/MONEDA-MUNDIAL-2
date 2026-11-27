'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createOrderStatusClient:create}=require('../../financial-sandbox/order-status-client.cjs');
const {createOrderStatusHttp}=require('../../financial-sandbox/order-status-http.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const req={orderId,sessionToken:'fixture-token'};
const value={mode:'sandbox',orderId,status:'funding_pending',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
const make=fetchImpl=>create({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',fetchImpl});
const response=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json','cache-control':'no-store'}});
test('client to actual HTTP handler preserves amounts and sends only approved request fields',async()=>{
 let calls=0;
 const handler=createOrderStatusHttp({environment:'sandbox',service:{async read(input){a.deepEqual(input,req);calls++;return {status:200,body:value};}}});
 const client=make(async(url,init)=>{a.equal(url,'https://sandbox.invalid/v1/sandbox/remittances/status');a.equal(init.redirect,'error');a.equal(init.credentials,'omit');a.equal(init.cache,'no-store');return handler(new Request(url,init));});
 a.deepEqual(await client.read(req),{ok:true,value});a.equal(calls,1);
});
test('invalid configuration and input do not send a token',async()=>{
 for(const sandboxOrigin of ['http://sandbox.invalid','https://user:pass@sandbox.invalid','https://sandbox.invalid/path','https://sandbox.invalid/?x=1'])a.throws(()=>create({environment:'sandbox',sandboxOrigin}));
 a.throws(()=>create({environment:'production',sandboxOrigin:'https://sandbox.invalid'}));
 let calls=0;const client=make(()=>{calls++;});
 a.deepEqual(await client.read({...req,sessionToken:'a b'}),{ok:false,code:'AUTH_REQUIRED'});
 a.deepEqual(await client.read({...req,orderId:'bad'}),{ok:false,code:'INVALID_REQUEST'});
 a.equal(calls,0);
});
test('wrong mode, wrong order, invalid balances, extra fields and oversized response fail closed',async()=>{
 for(const v of [{...value,mode:'production'},{...value,orderId:'other'},{...value,source:{...value.source,totalMinor:'10149'}},{...value,destination:{...value.destination,amountMinor:'9223372036854775808'}},{...value,acceptedAt:'2026-02-30T15:00:00.000Z'},{...value,secret:'do not expose'},{...value,extra:'x'.repeat(9000)}]){
  a.deepEqual(await make(()=>response(v)).read(req),{ok:false,code:'UNAVAILABLE'});
 }
 a.deepEqual(await make(()=>new Response(JSON.stringify(value))).read(req),{ok:false,code:'UNAVAILABLE'});
});
test('errors remain generic and timeout does not leak credentials',async()=>{
 for(const [status,code] of [[401,'AUTH_REQUIRED'],[404,'NOT_FOUND'],[500,'UNAVAILABLE'],[302,'UNAVAILABLE']]){
  a.deepEqual(await make(()=>new Response('secret',{status})).read(req),{ok:false,code});
 }
 a.deepEqual(await make(()=>{throw Error('private token');}).read(req),{ok:false,code:'UNAVAILABLE'});
 const client=create({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',timeoutMs:5,fetchImpl:async(url,init)=>new Promise((resolve,reject)=>{
  const keep=setTimeout(()=>resolve(response(value)),1000);
  init.signal.addEventListener('abort',()=>{clearTimeout(keep);reject(Error('aborted'));},{once:true});
 })});
 a.deepEqual(await client.read(req),{ok:false,code:'UNAVAILABLE'});
});

test('deadline bounds a transport that ignores abort; late response is discarded', {timeout:1000}, async()=>{
 let complete,signal,cancelled=false;
 const client=create({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',timeoutMs:10,fetchImpl:(_,init)=>{
  signal=init.signal;return new Promise(resolve=>{complete=resolve;});
 }});
 a.deepEqual(await client.read(req),{ok:false,code:'UNAVAILABLE'});
 a.equal(signal.aborted,true);
 const body=new ReadableStream({cancel(){cancelled=true;}});
 complete(new Response(body,{headers:{'content-type':'application/json','cache-control':'no-store'}}));
 await new Promise(resolve=>setImmediate(resolve));
 a.equal(cancelled,true);
});
test('deadline bounds a stalled response stream and requests its cancellation', {timeout:1000}, async()=>{
 let cancelled=false,signal;
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){cancelled=true;}});
 const client=create({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',timeoutMs:10,fetchImpl:(_,init)=>{
  signal=init.signal;return new Response(body,{headers:{'content-type':'application/json','cache-control':'no-store'}});
 }});
 a.deepEqual(await client.read(req),{ok:false,code:'UNAVAILABLE'});
 a.equal(signal.aborted,true);
 a.equal(cancelled,true);
});
test('late rejection after a deadline remains observed', {timeout:1000}, async()=>{
 let rejectLate;
 const client=create({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',timeoutMs:10,fetchImpl:()=>new Promise((_,reject)=>{rejectLate=reject;})});
 a.deepEqual(await client.read(req),{ok:false,code:'UNAVAILABLE'});
 rejectLate(Error('late transport failure'));
 await new Promise(resolve=>setImmediate(resolve));
});
