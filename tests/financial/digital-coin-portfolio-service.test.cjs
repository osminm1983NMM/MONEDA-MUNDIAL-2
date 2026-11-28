'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {createLedgerPortfolioService:create}=require('../../financial-sandbox/digital-coin-portfolio-service.cjs');
const snapshot={manifest:{format:'synthetic-digital-coin-manifest-v1'},projection:{mode:'sandbox',digital:{mode:'sandbox',accounts:[{owner:'alice',available:'100',reserved:'20'},{owner:'bob',available:'999',reserved:'0'}],redemptions:[]},coin:{mode:'sandbox',asset:'COIN_TEST',accounts:[{owner:'alice',available:'30',reserved:'0'}]},quotes:[]}};
function fixture(verifySession=async token=>token==='a'?{environment:'sandbox',actor:'alice'}:token==='b'?{environment:'sandbox',actor:'bob'}:null){
 let reads=0,checks=0;
 const service=create({environment:'sandbox',verifySession:async(...args)=>{checks++;return verifySession(...args);},ledger:{reconciliationSnapshot(){reads++;return snapshot;}}});
 return {service,reads:()=>reads,checks:()=>checks};
}
test('authenticated portfolio derives owner from verified session and reads only their assets',async()=>{
 const f=fixture();const x=await f.service.read({sessionToken:'a'}),y=await f.service.read({sessionToken:'b'});
 a.equal(x.status,200);a.equal(x.body.assets[0].totalMinor,'120');a.equal(y.body.assets[0].totalMinor,'999');a.equal(x.body.assets[1].totalMinor,'30');a.equal(y.body.assets[1].totalMinor,'0');a.equal(f.reads(),2);
});
test('actor injection, extra fields and accessor request fail before verification',async()=>{
 const f=fixture();let invoked=0;const getter={get sessionToken(){invoked++;return 'a';}};
 for(const req of [{sessionToken:'a',actor:'bob'},getter,null,[],{sessionToken:'a',[Symbol()]:true}])a.equal((await f.service.read(req)).status,400);
 a.equal(invoked,0);a.equal(f.checks(),0);a.equal(f.reads(),0);
});
test('invalid and revoked sessions are denied without reading ledger',async()=>{
 let active=true;const f=fixture(async token=>active&&token==='a'?{environment:'sandbox',actor:'alice'}:null);
 a.equal((await f.service.read({sessionToken:'a'})).status,200);active=false;
 a.equal((await f.service.read({sessionToken:'a'})).status,401);a.equal((await f.service.read({sessionToken:'bad'})).status,401);a.equal(f.reads(),1);
});
test('identity provider failure or cancellation never exposes a portfolio',async()=>{
 const f=fixture(async()=>{throw Error('PRIVATE_INTERNAL_DETAIL');});
 const x=await f.service.read({sessionToken:'a'});a.deepEqual(x,{status:503,body:{mode:'sandbox',error:'UNAVAILABLE'}});a.equal(f.reads(),0);
 const controller=new AbortController();const g=fixture(async()=>{controller.abort();return {environment:'sandbox',actor:'alice'};});
 a.equal((await g.service.read({sessionToken:'a'},controller.signal)).status,503);a.equal(g.reads(),0);
});
test('production sessions and treasury denied; production service cannot initialize',async()=>{
 for(const session of [{environment:'production',actor:'alice'},{environment:'sandbox',actor:'treasury'}]){const f=fixture(async()=>session);a.equal((await f.service.read({sessionToken:'a'})).status,401);a.equal(f.reads(),0);}
 a.throws(()=>create({environment:'production',verifySession:async()=>null,ledger:{reconciliationSnapshot(){return snapshot;}}}),/SANDBOX_ONLY/);
});

test('wallet rejects ambiguous verified identity and malformed request without reading ledger',async()=>{
 let invoked=0;
 const identity={environment:'sandbox',get actor(){invoked++;return 'bob';}};
 const hidden={environment:'sandbox',actor:'alice'};Object.defineProperty(hidden,'extra',{value:true});
 for(const bad of [identity,hidden,{environment:'sandbox',actor:'alice',[Symbol()]:true},Object.assign(Object.create({actor:'bob'}),{environment:'sandbox'}),new Proxy({environment:'sandbox',actor:'alice'},{ownKeys(){throw Error('private');}})]){
  const f=fixture(async()=>bad);a.equal((await f.service.read({sessionToken:'a'})).status,401);a.equal(f.reads(),0);
 }
 a.equal(invoked,0);
 const f=fixture();const bad=new Proxy({sessionToken:'a'},{ownKeys(){throw Error('private');}});
 a.equal((await f.service.read(bad)).status,400);a.equal(f.checks(),0);
 a.equal((await f.service.read({sessionToken:'a'})).status,200);
});
