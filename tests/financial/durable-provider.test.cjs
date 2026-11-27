'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join,resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const {openDurableProvider}=require('../../financial-sandbox/durable-provider.cjs');
const intent={mode:'sandbox',orderId:'order1',reference:'order1-funding',kind:'funding',currency:'USD',amountMinor:10150};
function setup(t){const dir=mkdtempSync(join(tmpdir(),'mwd-provider-lab-')),path=join(dir,'provider.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));return {environment:'sandbox',path,secret:'synthetic-provider-test-key-not-real'};}
test('missing provider database fails closed, initialization never overwrites',t=>{const f=setup(t);a.throws(()=>openDurableProvider(f),/PROVIDER_STATE_MISSING/);const p=openDurableProvider({...f,initialize:true});p.close();a.throws(()=>openDurableProvider({...f,initialize:true}),/EEXIST/);a.throws(()=>openDurableProvider({...f,secret:'different-synthetic-key-not-real-12345'}),/PROVIDER_KEY_MISMATCH/);});
test('lost acknowledgment persists after closing and reopening provider',async t=>{const f=setup(t);let p=openDurableProvider({...f,initialize:true});p.loseNextResponse();await a.rejects(p.submit(intent),/SIMULATED_RESPONSE_LOSS/);p.close();p=openDurableProvider(f);try{a.deepEqual(await p.lookup(intent.reference),{status:'accepted',intent});await p.submit(intent);a.equal(p.submissions().length,1);await a.rejects(p.submit({...intent,amountMinor:1}),/PROVIDER_IDEMPOTENCY_CONFLICT/);}finally{p.close();}});
test('event remains identical across restart and altered event ID reuse fails',async t=>{const f=setup(t);let p=openDurableProvider({...f,initialize:true});await p.submit(intent);const e=p.event(intent.reference,'funding_confirmed','event1');p.close();p=openDurableProvider(f);try{a.deepEqual(p.event(intent.reference,'funding_confirmed','event1'),e);a.equal(p.verifyEvent(e.raw,e.signature).amountMinor,10150);a.throws(()=>p.event(intent.reference,'funding_failed','event1'),/EVENT_ID_CONFLICT/);}finally{p.close();}});
test('committed provider submission survives abrupt child process termination',async t=>{const f=setup(t);const p=openDurableProvider({...f,initialize:true});p.close();const modulePath=resolve(__dirname,'../../financial-sandbox/durable-provider.cjs');const child=spawnSync(process.execPath,['-e','(async()=>{const p=require('+JSON.stringify(modulePath)+').openDurableProvider('+JSON.stringify(f)+');await p.submit('+JSON.stringify(intent)+');process.kill(process.pid,"SIGKILL")})().catch(()=>process.exit(2))'],{timeout:10000});a.equal(child.signal,'SIGKILL');const recovered=openDurableProvider(f);try{a.deepEqual(await recovered.lookup(intent.reference),{status:'accepted',intent});await recovered.submit(intent);a.equal(recovered.submissions().length,1);}finally{recovered.close();}});
test('expired events are not accepted merely because they were persisted',async t=>{let now=1000;const f={...setup(t),clock:()=>now};const p=openDurableProvider({...f,initialize:true});try{await p.submit(intent);const e=p.event(intent.reference,'funding_confirmed','event1');now+=300001;a.throws(()=>p.verifyEvent(e.raw,e.signature),/EVENT_EXPIRED/);}finally{p.close();}});

test('durable provider rejects invalid verification clock and enforces both freshness boundaries',async t=>{let now=1000000;const f={...setup(t),clock:()=>now};const p=openDurableProvider({...f,initialize:true});try{await p.submit(intent);const e=p.event(intent.reference,'funding_confirmed','clock-test');for(const bad of [NaN,Infinity,-1,1000000.5,'1000000',undefined,null,Number.MAX_SAFE_INTEGER+1]){now=bad;a.throws(()=>p.verifyEvent(e.raw,e.signature),/CLOCK/);a.throws(()=>p.event(intent.reference,'funding_confirmed','new-event'),/CLOCK/);}for(const delta of [-300000,300000]){now=1000000+delta;a.equal(p.verifyEvent(e.raw,e.signature).eventId,'clock-test');}for(const delta of [-300001,300001]){now=1000000+delta;a.throws(()=>p.verifyEvent(e.raw,e.signature),/EVENT_EXPIRED/);}}finally{p.close();}});

test('durable provider validates reference length before persistence, matching lookup and queue',async t=>{const p=openDurableProvider({...setup(t),initialize:true});try{const orderId='x'.repeat(120),valid={...intent,orderId,reference:orderId+'-funding'};await p.submit(valid);a.equal((await p.lookup(valid.reference)).status,'accepted');const long=orderId+'x';await a.rejects(p.submit({...intent,orderId:long,reference:long+'-funding'}),/INVALID_INTENT/);a.equal(p.submissions().length,1);}finally{p.close();}});

test('worker recovers both payout response losses across provider restarts', async t => {
 const {createWorker}=require('../../financial-sandbox/provider-worker.cjs');
 const config=setup(t);
 const payout={...intent,kind:'payout',currency:'HNL',reference:intent.orderId+'-payout'};
 let provider=openDurableProvider({...config,initialize:true});
 let acks=0, confirms=0, creates=0, records=0;
 const store={
  claim:()=>({intent:payout,token:'test-token',attempt:1}),
  checkLease:()=>true,
  checkSubmission:()=>true,
  ack:()=>{acks++;},
  record:()=>{records++;}
 };
 const worker=()=>createWorker({environment:'sandbox',store,provider:{
  ...provider,
  submit:async input=>{creates++;return provider.submit(input);},
  confirmPayout:async input=>{confirms++;return provider.confirmPayout(input);}
 }});
 try {
  provider.loseNextResponse();
  await a.rejects(worker().tick(),/SIMULATED_RESPONSE_LOSS/);
  a.equal((await provider.lookup(payout.reference)).status,'awaiting_confirmation');
  a.throws(()=>provider.event(payout.reference,'payout_confirmed','event1'),/PAYOUT_NOT_CONFIRMED/);
  a.equal(acks,0);
  provider.close();
  provider=openDurableProvider(config);

  provider.loseNextResponse();
  await a.rejects(worker().tick(),/SIMULATED_RESPONSE_LOSS/);
  a.equal((await provider.lookup(payout.reference)).status,'accepted');
  a.equal(acks,0);
  provider.close();
  provider=openDurableProvider(config);

  a.equal((await worker().tick()).status,'transport_acknowledged');
  a.deepEqual(provider.submissions(),[payout]);
  a.deepEqual({creates,confirms,acks,records},{creates:1,confirms:1,acks:1,records:0});
  const event=provider.event(payout.reference,'payout_confirmed','event1');
  await worker().receive(event.raw,event.signature);
  a.equal(records,1);
 } finally {
  provider.close();
 }
});

test('durable provider refuses to sign event IDs beyond the PostgreSQL limit',async t=>{
 const p=openDurableProvider({...setup(t),initialize:true});
 try{
  await p.submit(intent);
  const valid='x'.repeat(100);
  a.throws(()=>p.event(intent.reference,'funding_confirmed',valid+'x'),/INVALID_EVENT/);
  const {raw,signature}=p.event(intent.reference,'funding_confirmed',valid);
  a.equal(p.verifyEvent(raw,signature).eventId,valid);
 }finally{p.close();}
});
