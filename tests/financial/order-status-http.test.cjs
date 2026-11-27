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
