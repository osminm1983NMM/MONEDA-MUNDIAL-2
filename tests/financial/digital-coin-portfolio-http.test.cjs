'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {createPortfolioHttp:create,validPortfolio}=require('../../financial-sandbox/digital-coin-portfolio-http.cjs');
const {createLedgerPortfolioService}=require('../../financial-sandbox/digital-coin-portfolio-service.cjs');
const url='https://sandbox.invalid/v1/sandbox/wallet/portfolio';
const req=(token='a',path=url,options={})=>new Request(path,{headers:{authorization:'Bearer '+token},...options});
const payload={mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:'10',reservedMinor:'2',totalMinor:'12'},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]};
test('wallet response contract rejects extra data, wrong assets, invalid balances and duplicate quotes',()=>{
 a.equal(validPortfolio(payload),true);
 for(const bad of [{...payload,owner:'alice'},{...payload,assets:[...payload.assets].reverse()},{...payload,assets:[{...payload.assets[0],totalMinor:'13'},payload.assets[1]]},{...payload,pendingRedemptionUsdMinor:'-1'}])a.equal(validPortfolio(bad),false);
 const q={quoteId:'q',direction:'digital_to_coin',digitalMinor:'1',coinMinor:'2',state:'quoted',expiresAt:10};
 a.equal(validPortfolio({...payload,conversions:[q]}),true);
 a.equal(validPortfolio({...payload,conversions:[q,q]}),false);
 a.equal(validPortfolio({...payload,conversions:[{...q,owner:'bob'}]}),false);
});
test('GET wallet returns only authenticated owner data with no-store',async()=>{
 const snapshot={manifest:{format:'synthetic-digital-coin-manifest-v1'},projection:{mode:'sandbox',digital:{mode:'sandbox',accounts:[{owner:'alice',available:'10',reserved:'2'},{owner:'bob',available:'99',reserved:'0'}],redemptions:[]},coin:{mode:'sandbox',asset:'COIN_TEST',accounts:[]},quotes:[]}};
 const service=createLedgerPortfolioService({environment:'sandbox',verifySession:async token=>({environment:'sandbox',actor:token==='a'?'alice':'bob'}),ledger:{reconciliationSnapshot:()=>snapshot}});
 const http=create({environment:'sandbox',service});
 const x=await http(req());a.equal(x.status,200);a.equal(x.headers.get('cache-control'),'no-store');a.deepEqual(await x.json(),payload);
 const y=await http(req('b'));a.equal((await y.json()).assets[0].totalMinor,'99');
});
test('no auth, client-selected owner, wrong route, write and body metadata are rejected before service',async()=>{
 let calls=0;const http=create({environment:'sandbox',service:{read:async()=>{calls++;return {status:200,body:payload};}}});
 for(const [request,status] of [[new Request(url),401],[req('a',url+'?owner=bob'),400],[req('a','https://sandbox.invalid/other'),404],[req('a',url,{method:'POST'}),405],[req('a',url,{headers:{authorization:'Bearer a','content-length':'10'}}),400]])a.equal((await http(request)).status,status);
 a.equal(calls,0);
});
test('invalid server data and private errors fail closed',async()=>{
 const http=create({environment:'sandbox',service:{read:async()=>({status:200,body:{...payload,journal:['private']}})}});
 const res=await http(req());a.equal(res.status,503);a.deepEqual(await res.json(),{mode:'sandbox',error:'UNAVAILABLE'});
 const auth=create({environment:'sandbox',service:{read:async()=>({status:401,body:{secret:'private'}})}});
 a.deepEqual(await (await auth(req())).json(),{mode:'sandbox',error:'AUTH_REQUIRED'});
});
test('timed out operation retains slot until settled; cancellation signal delivered',async()=>{
 let release,calls=0,signal;const http=create({environment:'sandbox',maxActive:1,timeoutMs:20,service:{read:async(_,s)=>{calls++;signal=s;await new Promise(resolve=>{release=resolve;});return {status:200,body:payload};}}});
 const first=await http(req());a.equal(first.status,503);a.equal(signal.aborted,true);
 a.equal((await http(req())).status,503);a.equal(calls,1);release();
 await new Promise(resolve=>setImmediate(resolve));
 const pending=http(req());await new Promise(resolve=>setImmediate(resolve));release();a.equal((await pending).status,200);
});

test('wallet rejects and cancels unread streams on wrong method, route or already aborted request',async()=>{
 let calls=0;
 const http=create({environment:'sandbox',service:{read(){calls++;return {status:200,body:payload};}}});
 for(const [target,status,aborted] of [[url,405,false],[url+'/other',404,false],[url+'?owner=bob',400,false],[url+'#fragment',400,false],[url,408,true]]){
  let cancelled=false;
  const controller=new AbortController();
  const body=new ReadableStream({cancel(){cancelled=true;}});
  const request=req('a',target,{method:'POST',body,duplex:'half',signal:controller.signal});
  if(aborted)controller.abort();
  a.equal((await http(request)).status,status);
  a.equal(cancelled,true);
 }
 a.equal(calls,0);
 a.equal((await http(req())).status,200);
 a.equal(calls,1);
});
test('wallet disconnect aborts service, discards late results and preserves admission limit',{timeout:2000},async()=>{
 let calls=0,release,started,signal;
 const ready=new Promise(resolve=>{started=resolve;});
 const http=create({environment:'sandbox',maxActive:1,timeoutMs:1000,service:{read(_,s){
  calls++;signal=s;
  if(calls===1){started();return new Promise(resolve=>{release=resolve;});}
  return {status:200,body:payload};
 }}});
 const controller=new AbortController();
 const pending=http(req('a',url,{signal:controller.signal}));
 await ready;controller.abort();
 const response=await pending;
 a.equal(response.status,408);a.equal(signal.aborted,true);
 a.deepEqual(await response.json(),{mode:'sandbox',error:'INVALID_REQUEST'});
 a.equal((await http(req())).status,503);a.equal(calls,1);
 release({status:200,body:payload});await new Promise(resolve=>setImmediate(resolve));
 a.equal((await http(req())).status,200);a.equal(calls,2);
});

test('wallet validates exact serialized response and rejects private data from hidden toJSON',async()=>{
 const nested={...payload.assets[0]};
 Object.defineProperty(nested,'toJSON',{value:()=>({...payload.assets[0],privateAccount:'fixture-secret'})});
 const root={...payload};
 Object.defineProperty(root,'toJSON',{value:()=>({...payload,privateJournal:'fixture-secret'})});
 for(const body of [root,{...payload,assets:[nested,payload.assets[1]]}]){
  const http=create({environment:'sandbox',service:{read:async()=>({status:200,body})}});
  const r=await http(req());a.equal(r.status,503);a.deepEqual(await r.json(),{mode:'sandbox',error:'UNAVAILABLE'});
 }
 const http=create({environment:'sandbox',service:{read:async()=>({status:200,body:payload})}});
 const r=await http(req());a.equal(r.status,200);a.equal(await r.text(),JSON.stringify(payload));
});
