'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os'),{join}=require('node:path');
const {DurableSandboxQueue:Q}=require('../../financial-sandbox/durable-queue.cjs');
const {createMockProvider}=require('../../financial-sandbox/mock-provider.cjs');
const intent={reference:'order1-funding',orderId:'order1',kind:'funding',currency:'USD',amountMinor:10150,mode:'sandbox'};
function fixture(t){let time=1000;const dir=mkdtempSync(join(tmpdir(),'mwd-synthetic-')),path=join(dir,'queue.sqlite'),clock=()=>time;const handles=new Set();
 const open=()=>{const q=new Q({environment:'sandbox',path,clock});handles.add(q);return q;};
 const close=q=>{q.close();handles.delete(q);};
 t.after(()=>{for(const q of handles)q.close();rmSync(dir,{recursive:true,force:true});});
 return {open,close,clock,advance:n=>time+=n};
}
test('sandbox only and strict validated intents',t=>{a.throws(()=>new Q({environment:'production',path:':memory:'}),/SANDBOX_ONLY/);const f=fixture(t),q=f.open();for(const patch of [{mode:'live'},{amountMinor:0},{currency:'HNL'},{kind:'other'}])a.throws(()=>q.enqueue({...intent,...patch}),/INVALID_INTENT/);});
test('enqueue durable across close/reopen; conflict never overwrites',t=>{const f=fixture(t),q=f.open();q.enqueue(intent);f.close(q);const r=f.open();a.equal(r.enqueue(intent).duplicate,true);a.throws(()=>r.enqueue({...intent,amountMinor:1}),/IDEMPOTENCY_CONFLICT/);a.deepEqual(r.claim().intent,intent);});
test('two database handles cannot lease same active intent',t=>{const f=fixture(t),q=f.open(),r=f.open();q.enqueue(intent);const first=q.claim();a.ok(first);a.equal(r.claim(),null);});
test('expired lease recovers stable reference; old worker fenced',t=>{const f=fixture(t),q=f.open();q.enqueue(intent);const first=q.claim({leaseMs:10});f.close(q);f.advance(10);const r=f.open(),second=r.claim();a.equal(second.attempt,2);a.deepEqual(second.intent,first.intent);a.notEqual(second.token,first.token);a.throws(()=>r.acknowledge(intent.reference,first.token),/STALE_LEASE/);a.equal(r.acknowledge(intent.reference,second.token).state,'acknowledged');a.equal(r.claim(),null);});
test('expired lease cannot acknowledge even before another worker claims',t=>{const f=fixture(t),q=f.open();q.enqueue(intent);const l=q.claim({leaseMs:1});f.advance(1);a.throws(()=>q.acknowledge(intent.reference,l.token),/STALE_LEASE/);});
test('lost provider response plus worker restart retries same provider reference',async t=>{const f=fixture(t),q=f.open(),p=createMockProvider({secret:'synthetic-secret-for-local-queue-tests',clock:f.clock});q.enqueue(intent);const first=q.claim({leaseMs:5});p.loseNextResponse();await a.rejects(p.submit(first.intent),/RESPONSE_LOSS/);f.close(q);f.advance(5);const r=f.open(),second=r.claim();await p.submit(second.intent);r.acknowledge(second.intent.reference,second.token);a.equal(p.submissions().length,1);a.equal(r.claim(),null);});
test('authenticated event receipt persists and replay is detected without applying accounting',async t=>{const f=fixture(t),q=f.open(),p=createMockProvider({secret:'synthetic-secret-for-local-queue-tests',clock:f.clock});await p.submit(intent);const e=p.event(intent.reference,'funding_confirmed','evt1');a.throws(()=>q.ingest({...e,signature:'0'.repeat(64),provider:p}),/INVALID_SIGNATURE/);a.equal(q.ingest({...e,provider:p}).status,'recorded_not_applied');f.close(q);const r=f.open();a.equal(r.ingest({...e,provider:p}).status,'duplicate');const altered=p.event(intent.reference,'funding_confirmed','evt1',{amountMinor:1});a.throws(()=>r.ingest({...altered,provider:p}),/EVENT_ID_CONFLICT/);a.equal(r.counts().inbox,1);});
test('acknowledgment does not manufacture provider event',t=>{const f=fixture(t),q=f.open();q.enqueue(intent);const l=q.claim();q.acknowledge(intent.reference,l.token);a.equal(q.counts().inbox,0);a.equal(q.enqueue(intent).state,'acknowledged');});

test('outbox rejects aliases of the same order and action before persistence',t=>{const f=fixture(t),q=f.open();for(const patch of [{reference:'alias-funding'},{orderId:'other'},{kind:'refund'}])a.throws(()=>q.enqueue({...intent,...patch}),/INVALID_INTENT/);a.deepEqual(q.counts().outbox,[]);q.enqueue(intent);a.equal(q.enqueue(intent).duplicate,true);});
test('signed but malformed financial events cannot enter durable inbox',async t=>{const f=fixture(t),q=f.open(),p=createMockProvider({secret:'synthetic-secret-for-local-queue-tests',clock:f.clock});await p.submit(intent);for(const patch of [{reference:'alias-funding'},{orderId:'other'},{type:'funding_pending'},{type:'payout_confirmed'},{currency:'HNL'},{amountMinor:0},{amountMinor:1.5},{amountMinor:'10150'},{amountMinor:Number.MAX_SAFE_INTEGER+1}]){const e=p.event(intent.reference,'funding_confirmed','bad-event',patch);a.throws(()=>q.ingest({...e,provider:p}),/INVALID_EVENT/);}a.equal(q.counts().inbox,0);const e=p.event(intent.reference,'funding_confirmed','bad-event');a.equal(q.ingest({...e,provider:p}).status,'recorded_not_applied');a.equal(q.counts().inbox,1);});

test('worker and local inbox accept 100-character event IDs and reject longer IDs before writing',async t=>{
 const {createWorker}=require('../../financial-sandbox/provider-worker.cjs');
 const f=fixture(t),q=f.open();
 const provider=createMockProvider({secret:'synthetic-secret-for-event-limits-only',clock:f.clock});
 const stored=[];
 const worker=createWorker({environment:'sandbox',provider,store:{
  claim(){},checkLease(){},ack(){},record(event){stored.push(event);}
 }});
 await provider.submit(intent);
 const valid='x'.repeat(100);
 for(const [eventId,patch] of [[valid+'x',{}],[valid,{amountMinor:Number.MAX_SAFE_INTEGER+1}]]){
  const event=provider.event(intent.reference,'funding_confirmed',eventId,patch);
  await a.rejects(worker.receive(event.raw,event.signature),/INVALID_EVENT/);
  a.throws(()=>q.ingest({...event,provider}),/INVALID_EVENT/);
 }
 a.equal(stored.length,0);
 a.equal(q.counts().inbox,0);
 const event=provider.event(intent.reference,'funding_confirmed',valid);
 await worker.receive(event.raw,event.signature);
 a.equal(stored[0].eventId,valid);
 a.equal(q.ingest({...event,provider}).status,'recorded_not_applied');
 a.equal(q.counts().inbox,1);
});
