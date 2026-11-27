'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {createPortfolioClient:create}=require('../../financial-sandbox/digital-coin-portfolio-client.cjs');
const {createPortfolioHttp}=require('../../financial-sandbox/digital-coin-portfolio-http.cjs');
const origin='https://sandbox.invalid';
const payload={mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:'10',reservedMinor:'2',totalMinor:'12'},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]};
const response=(body=JSON.stringify(payload),status=200,headers={'content-type':'application/json','cache-control':'no-store'})=>new Response(body,{status,headers});
const client=(fetchImpl,extra={})=>create({environment:'sandbox',sandboxOrigin:origin,fetchImpl,...extra});
test('client reads authenticated sandbox endpoint and validates exact balances',async()=>{
 const handler=createPortfolioHttp({environment:'sandbox',service:{read:async({sessionToken})=>sessionToken==='valid'?{status:200,body:payload}:{status:401}}});
 const c=client(async(url,options)=>{
  a.equal(url,origin+'/v1/sandbox/wallet/portfolio');a.equal(options.method,'GET');a.equal(options.redirect,'error');a.equal(options.credentials,'omit');a.equal(options.cache,'no-store');
  return handler(new Request(url,options));
 });
 a.deepEqual(await c.read('valid'),{ok:true,value:payload});a.deepEqual(await c.read('revoked'),{ok:false,code:'AUTH_REQUIRED'});
});
test('client rejects unsafe origin, production and malformed token before network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return response();};
 for(const sandboxOrigin of ['http://sandbox.invalid','https://user@sandbox.invalid','https://sandbox.invalid/path','https://sandbox.invalid/?q=1'])a.throws(()=>create({environment:'sandbox',sandboxOrigin,fetchImpl}),/INVALID_ORIGIN/);
 a.throws(()=>create({environment:'production',sandboxOrigin:origin,fetchImpl}),/SANDBOX_ONLY/);
 const c=client(fetchImpl);for(const token of [undefined,'','bad token','x\ny'])a.deepEqual(await c.read(token),{ok:false,code:'AUTH_REQUIRED'});
 a.equal(calls,0);
});
test('client rejects invalid schema, duplicate JSON keys, oversized body and missing cache control',async()=>{
 const duplicate=JSON.stringify(payload).replace('"mode":"sandbox"','"mode":"sandbox","mode":"sandbox"');
 for(const make of [()=>response(duplicate),()=>response(JSON.stringify({...payload,owner:'private'})),()=>response('x'.repeat(1024*1024+1)),()=>response(JSON.stringify(payload),200,{'content-type':'application/json'}),()=>response(JSON.stringify(payload).replace('"12"','"13"'))]){
  a.deepEqual(await client(async()=>make()).read('valid'),{ok:false,code:'UNAVAILABLE'});
 }
});
test('client refuses redirected or wrong-origin responses',async()=>{
 for(const key of ['redirected','url']){
  const res=response();Object.defineProperty(res,key,{value:key==='redirected'?true:'https://elsewhere.invalid'});
  a.deepEqual(await client(async()=>res).read('valid'),{ok:false,code:'UNAVAILABLE'});
 }
});
test('timeout retains capacity and late data is discarded; explicit abort works',async()=>{
 let release,calls=0;
 const c=client(async()=>{calls++;return new Promise(resolve=>{release=resolve;});},{maxActive:1,timeoutMs:20});
 a.deepEqual(await c.read('valid'),{ok:false,code:'UNAVAILABLE'});
 a.deepEqual(await c.read('valid'),{ok:false,code:'UNAVAILABLE'});a.equal(calls,1);
 release(response());await new Promise(resolve=>setImmediate(resolve));
 const controller=new AbortController();const pending=c.read('valid',controller.signal);controller.abort();
 a.deepEqual(await pending,{ok:false,code:'UNAVAILABLE'});a.equal(calls,2);release(response());
});
