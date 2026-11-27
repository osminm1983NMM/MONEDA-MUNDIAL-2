'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {openAuthenticatedMulticurrencyLab}=require('../../financial-sandbox/authenticated-multicurrency-lab.cjs');
const secret='synthetic-fixture-only-not-a-real-credential';
const order={mode:'sandbox',id:'order-1',principalUsdMinor:10000,feeUsdMinor:150,payoutHnlMinor:250000};
const event=(eventId,type,fields={})=>({mode:'sandbox',orderId:order.id,eventId,type,...fields});
const funding=event('funding','funding_confirmed',{usdMinor:10150});
const fx=event('fx','fx_acquired',{usdMinor:10000,hnlMinor:250000,costUsdMinor:40});
const payout=event('payout','payout_confirmed',{hnlMinor:250000});
const sign=(raw,key=secret,domain='mwd:synthetic-multicurrency:v1\n')=>({raw,signature:createHmac('sha256',key).update(domain).update(raw).digest('hex')});
const envelope=(event,patch={})=>sign(JSON.stringify({mode:'sandbox',provider:'mock-multicurrency',timestamp:1000000,event,...patch}));
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'mwd-auth-multi-'));let store;
 const config={environment:'sandbox',path:join(dir,'ledger.sqlite'),secret,clock:()=>1000000};
 try{store=openAuthenticatedMulticurrencyLab({...config,initialize:true});store.create(order);fn({store,config,reopen(){store.close();store=openAuthenticatedMulticurrencyLab(config);return store;}});}
 finally{if(store)store.close();rmSync(dir,{recursive:true,force:true});}
}
test('authenticated funding, FX and payout survive restart without a direct append interface',()=>fixture(({store,reopen})=>{
 a.equal(store.append,undefined);
 for(const e of [funding,fx])a.equal(store.receive(envelope(e)).status,'applied');
 store=reopen();a.equal(store.get(order.id).state,'fx_acquired');
 a.equal(store.receive(envelope(payout)).projection.state,'paid');
 a.equal(store.receive(envelope(funding,{timestamp:1000001})).status,'duplicate');
 a.deepEqual(store.counts(),{orders:1,events:3});
}));
test('wrong key, tampered bytes, cross-domain signature and unsigned input cannot modify state',()=>fixture(({store})=>{
 const good=envelope(funding);
 for(const bad of [sign(good.raw,'different-synthetic-fixture-key-123456789'),{...good,raw:good.raw.replace('10150','10151')},sign(good.raw,secret,''),{raw:good.raw}, {...good,signature:'0'.repeat(64)}])a.throws(()=>store.receive(bad),/INVALID_SIGNATURE/);
 a.equal(store.get(order.id).state,'awaiting_funding');a.equal(store.counts().events,0);
}));
test('signed stale, future, wrong source and malformed envelopes fail without consuming event',()=>fixture(({store})=>{
 for(const timestamp of [699999,1300001,'1000000',-1])a.throws(()=>store.receive(envelope(funding,{timestamp})),/EVENT_EXPIRED/);
 for(const patch of [{mode:'production'},{provider:'other'},{unexpected:true},{event:null}])a.throws(()=>store.receive(envelope(funding,patch)),/INVALID_ENVELOPE/);
 a.throws(()=>store.receive(sign('{')),/INVALID_ENVELOPE/);
 a.equal(store.counts().events,0);
 a.equal(store.receive(envelope(funding)).status,'applied');
}));
test('valid signature does not override amount, order, transition or replay rules',()=>fixture(({store})=>{
 a.throws(()=>store.receive(envelope(payout)),/INVALID_TRANSITION/);
 a.throws(()=>store.receive(envelope({...funding,usdMinor:10151})),/AMOUNT_MISMATCH/);
 a.throws(()=>store.receive(envelope({...funding,orderId:'unknown'})),/ORDER_NOT_FOUND/);
 store.receive(envelope(funding));
 a.throws(()=>store.receive(envelope({...funding,usdMinor:10151})),/EVENT_ID_CONFLICT/);
 a.equal(store.counts().events,1);
 a.equal(store.get(order.id).state,'funded');
}));
test('production and missing synthetic secret rejected before opening database',()=>{
 a.throws(()=>openAuthenticatedMulticurrencyLab({environment:'production'}),/SANDBOX_ONLY/);
 a.throws(()=>openAuthenticatedMulticurrencyLab({environment:'sandbox',secret:'short'}),/TEST_SECRET_REQUIRED/);
});
