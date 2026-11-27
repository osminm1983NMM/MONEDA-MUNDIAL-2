'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createOrderStatusHttp,route}=require('../../financial-sandbox/order-status-http.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const url='https://sandbox.invalid'+route;
const make=(opts={})=>new Request(opts.url??url,{method:opts.method??'POST',headers:opts.headers??{'authorization':'Bearer fixture-token','content-type':'application/json'},...((opts.method??'POST')==='GET'?{}:{body:opts.body??JSON.stringify({orderId})})});
function fixture(result={status:200,body:{mode:'sandbox',orderId,status:'funding_pending'}}){
 const calls=[];return {calls,handle:createOrderStatusHttp({environment:'sandbox',service:{async read(request){calls.push(request);if(result instanceof Error)throw result;return result;}}})};
}
test('HTTP exposes only the explicit sandbox query and prevents caching',async()=>{
 const f=fixture(),r=await f.handle(make());
 a.equal(r.status,200);a.equal(r.headers.get('cache-control'),'no-store');a.equal(r.headers.get('x-content-type-options'),'nosniff');
 a.deepEqual(f.calls,[{sessionToken:'fixture-token',orderId}]);
 a.equal((await r.json()).orderId,orderId);
});
test('reject routing, token, body and media type before invoking service',async()=>{
 const f=fixture();
 const cases=[[make({url:url+'?actor=victim'}),400],[make({url:url+'/other'}),404],[make({method:'GET'}),405],[make({headers:{'content-type':'application/json'}}),401],[make({headers:{authorization:'Bearer a, Bearer b','content-type':'application/json'}}),401],[make({headers:{authorization:'Bearer t','content-type':'text/plain'}}),415],[make({body:'{'}),400],[make({body:JSON.stringify({orderId,actor:'victim'})}),400],[make({body:JSON.stringify({orderId:'not-a-uuid'})}),400],[make({body:'x'.repeat(1025)}),413]];
 for(const [request,status] of cases){const r=await f.handle(request);a.equal(r.status,status);a.equal(r.headers.get('cache-control'),'no-store');}
 a.equal(f.calls.length,0);
});
test('safe errors do not forward private service diagnostics or production response',async()=>{
 for(const [result,status,code] of [[{status:401,body:{detail:'secret'}},401,'AUTH_REQUIRED'],[{status:404,body:{detail:'secret'}},404,'NOT_FOUND'],[{status:200,body:{mode:'production'}},503,'UNAVAILABLE'],[new Error('secret'),503,'UNAVAILABLE']]){
  const r=await fixture(result).handle(make());a.equal(r.status,status);a.deepEqual(await r.json(),{mode:'sandbox',error:code});
 }
 a.throws(()=>createOrderStatusHttp({environment:'production',service:{read(){}}}),/SANDBOX_ONLY/);
});

test('bounded body read cancels stalled upload without invoking service',{timeout:2000},async()=>{
 let cancelled=false,calls=0;
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"orderId":'));},cancel(){cancelled=true;}});
 const handle=createOrderStatusHttp({environment:'sandbox',bodyTimeoutMs:20,maxActive:1,service:{async read(){calls++;return {status:404};}}});
 const r=await handle(new Request(url,{method:'POST',headers:{authorization:'Bearer t','content-type':'application/json'},body:stream,duplex:'half'}));
 a.equal(r.status,408);a.equal(cancelled,true);a.equal(calls,0);
 a.equal((await handle(make())).status,404);a.equal(calls,1);
});
test('timed out service retains capacity until settlement and discards late response',{timeout:2000},async()=>{
 let complete,calls=0;
 const handle=createOrderStatusHttp({environment:'sandbox',serviceTimeoutMs:20,maxActive:1,service:{read(){calls++;return calls===1?new Promise(resolve=>{complete=resolve;}):{status:404};}}});
 const first=await handle(make());a.equal(first.status,503);a.deepEqual(await first.json(),{mode:'sandbox',error:'UNAVAILABLE'});
 a.equal((await handle(make())).status,503);a.equal(calls,1);
 complete({status:200,body:{mode:'sandbox',orderId}});await new Promise(resolve=>setImmediate(resolve));
 a.equal((await handle(make())).status,404);a.equal(calls,2);
});
test('late service rejection releases capacity and does not escape as an unhandled rejection',{timeout:2000},async()=>{
 let rejectLate,calls=0;
 const handle=createOrderStatusHttp({environment:'sandbox',serviceTimeoutMs:20,maxActive:1,service:{read(){calls++;return calls===1?new Promise((_,reject)=>{rejectLate=reject;}):{status:404};}}});
 a.equal((await handle(make())).status,503);rejectLate(Error('private'));await new Promise(resolve=>setImmediate(resolve));
 a.equal((await handle(make())).status,404);a.equal(calls,2);
});
test('admission is bounded across incomplete uploads and invalid limits fail closed',{timeout:2000},async()=>{
 let cancelled=false;
 const handle=createOrderStatusHttp({environment:'sandbox',bodyTimeoutMs:100,maxActive:1,service:{read(){throw Error('not reached');}}});
 const body=new ReadableStream({cancel(){cancelled=true;}});
 const pending=handle(new Request(url,{method:'POST',headers:{authorization:'Bearer t','content-type':'application/json'},body,duplex:'half'}));
 a.equal((await handle(make())).status,503);
 a.equal((await pending).status,408);a.equal(cancelled,true);
 for(const opts of [{maxActive:0},{maxActive:257},{bodyTimeoutMs:0},{serviceTimeoutMs:Infinity}])a.throws(()=>createOrderStatusHttp({environment:'sandbox',service:{read(){}},...opts}),/INVALID_HTTP_LIMITS/);
});

test('single-field wire contract rejects duplicate keys and escaped aliases before authentication',async()=>{
 const f=fixture();
 for(const body of [
  '{"orderId":"'+orderId+'","orderId":"'+orderId+'"}',
  '{"orderId":"'+orderId+'","order\\u0049d":"'+orderId+'"}',
  '{"order\\u0049d":"'+orderId+'"}',
  '\ufeff'+JSON.stringify({orderId})
 ]){
  a.equal((await f.handle(make({body}))).status,400);
 }
 a.equal(f.calls.length,0);
 a.equal((await f.handle(make({body:' \n { "orderId" : "'+orderId+'" }\t'}))).status,200);
 a.equal(f.calls.length,1);
});
