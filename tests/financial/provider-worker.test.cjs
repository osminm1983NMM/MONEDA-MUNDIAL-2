'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createWorker}=require('../../financial-sandbox/provider-worker.cjs');
const {createMockProvider}=require('../../financial-sandbox/mock-provider.cjs');
function fixture(){
 const provider=createMockProvider({secret:'synthetic-worker-test-secret-only-12345'});
 const intent={mode:'sandbox',orderId:'order1',reference:'order1-funding',kind:'funding',currency:'USD',amountMinor:10150};
 let acks=0,records=0;
 const store={claim:()=>({intent,token:'test-token',attempt:1}),checkLease:()=>true,ack:()=>{acks++},record:()=>{records++;return 'funded'}};
 return {provider,intent,store,worker:()=>createWorker({environment:'sandbox',provider,store}),counts:()=>({acks,records,submissions:provider.submissions().length})};
}
test('unknown provider lookup never sends',async()=>{const f=fixture();f.provider.lookup=async()=>({status:'unknown'});a.equal((await f.worker().tick()).status,'provider_uncertain');a.deepEqual(f.counts(),{acks:0,records:0,submissions:0});});
test('changed risk or expired lease blocks sending',async()=>{const f=fixture();f.store.checkLease=()=>false;a.equal((await f.worker().tick()).status,'held');a.equal(f.counts().submissions,0);});
test('existing conflicting provider reference never sends or acknowledges',async()=>{const f=fixture();f.provider.lookup=async()=>({status:'accepted',intent:{...f.intent,amountMinor:1}});await a.rejects(f.worker().tick(),/PROVIDER_REFERENCE_CONFLICT/);a.equal(f.counts().acks,0);});
test('transport acknowledgment does not record financial event',async()=>{const f=fixture();a.equal((await f.worker().tick()).status,'transport_acknowledged');a.deepEqual(f.counts(),{acks:1,records:0,submissions:1});});
test('signed event with wrong reference or currency rejected',async()=>{const f=fixture();await f.worker().tick();for(const patch of [{reference:'wrong'},{currency:'HNL'}]){const e=f.provider.event(f.intent.reference,'funding_confirmed','event1',patch);await a.rejects(f.worker().receive(e.raw,e.signature),/INVALID_EVENT/);}a.equal(f.counts().records,0);});
test('live mode rejected',()=>{const f=fixture();a.throws(()=>createWorker({environment:'production',provider:f.provider,store:f.store}),/SANDBOX_ONLY/);});

test('invalid provider clock cannot pass a signed event into the worker inbox',async()=>{const f=fixture();let now=1000000;f.provider=createMockProvider({secret:'synthetic-worker-clock-test-secret-only',clock:()=>now});const w=createWorker({environment:'sandbox',provider:f.provider,store:f.store});await w.tick();const e=f.provider.event(f.intent.reference,'funding_confirmed','clock-test');for(const bad of [NaN,Infinity,-1,1000000.5,'1000000',undefined,null,Number.MAX_SAFE_INTEGER+1]){now=bad;await a.rejects(w.receive(e.raw,e.signature),/CLOCK/);a.throws(()=>f.provider.event(f.intent.reference,'funding_confirmed','new-event'),/CLOCK/);}now=1000000;const negative=f.provider.event(f.intent.reference,'funding_confirmed','negative-time',{timestamp:-1});await a.rejects(w.receive(negative.raw,negative.signature),/EVENT_EXPIRED/);for(const delta of [-300001,300001]){now=1000000+delta;await a.rejects(w.receive(e.raw,e.signature),/EVENT_EXPIRED/);}a.equal(f.counts().records,0);now=1000000+300000;await w.receive(e.raw,e.signature);a.equal(f.counts().records,1);});

test('worker rejects non-boolean lease authorization without submitting or acknowledging',async()=>{for(const invalid of ['false',1,{},[],null,undefined]){const f=fixture();f.store.checkLease=()=>invalid;a.equal((await f.worker().tick()).status,'held');a.deepEqual(f.counts(),{acks:0,records:0,submissions:0});}});
test('worker rejects overlong references before any provider lookup',async()=>{const f=fixture();f.intent.orderId='x'.repeat(121);f.intent.reference=f.intent.orderId+'-funding';let calls=0;f.provider.lookup=async()=>{calls++;return {status:'absent'};};await a.rejects(f.worker().tick(),/INVALID_LEASE/);a.equal(calls,0);a.deepEqual(f.counts(),{acks:0,records:0,submissions:0});});
test('worker rejects signed non-string event type and overlong reference',async()=>{const f=fixture();await f.worker().tick();for(const patch of [{type:['funding_confirmed']},{orderId:'x'.repeat(121),reference:'x'.repeat(121)+'-funding'}]){const e=f.provider.event(f.intent.reference,'funding_confirmed','malformed-event',patch);await a.rejects(f.worker().receive(e.raw,e.signature),/INVALID_EVENT/);}a.equal(f.counts().records,0);});

test('worker preserves the canonical claimed payload across asynchronous checks',async()=>{
 const f=fixture(),original={...f.intent},lookup=f.provider.lookup.bind(f.provider);
 f.provider.lookup=async reference=>{const result=await lookup(reference);f.intent.amountMinor=999;f.intent.reference='altered-funding';return result;};
 f.store.checkLease=(reference,token)=>{a.equal(reference,original.reference);a.equal(token,'test-token');f.intent.currency='HNL';return true;};
 const submit=f.provider.submit.bind(f.provider);
 f.provider.submit=async input=>{a.equal(Object.isFrozen(input),true);a.deepEqual(input,original);return submit(input);};
 f.store.ack=(reference,token)=>{a.equal(reference,original.reference);a.equal(token,'test-token');};
 a.deepEqual(await f.worker().tick(),{status:'transport_acknowledged',reference:original.reference});
 a.deepEqual(f.provider.submissions(),[original]);
});
test('worker sends only canonical intent fields, excluding untrusted extra metadata',async()=>{
 const f=fixture();f.intent.untrusted='ignore-me';await f.worker().tick();
 a.deepEqual(f.provider.submissions(),[{mode:'sandbox',orderId:'order1',reference:'order1-funding',kind:'funding',currency:'USD',amountMinor:10150}]);
});

test('worker rechecks the lease between creating and confirming a payout',async()=>{
 const f=fixture();
 Object.assign(f.intent,{kind:'payout',currency:'HNL',reference:'order1-payout'});
 let checks=0,confirms=0;
 f.store.checkLease=()=>++checks===1;
 f.provider.submit=async input=>({accepted:false,reference:input.reference,status:'awaiting_confirmation'});
 f.provider.confirmPayout=async input=>{confirms++;return {accepted:true,reference:input.reference};};
 a.equal((await f.worker().tick()).status,'held');
 a.equal(checks,2);
 a.equal(confirms,0);
 a.equal(f.counts().acks,0);
});

test('worker rejects a mismatched unconfirmed payout and an ambiguous confirmation',async()=>{
 const f=fixture();
 Object.assign(f.intent,{kind:'payout',currency:'HNL',reference:'order1-payout'});
 let confirms=0;
 f.provider.confirmPayout=async()=>{confirms++;return {accepted:true,reference:'some-other-payout'};};
 f.provider.lookup=async()=>({status:'awaiting_confirmation',intent:{...f.intent,amountMinor:1}});
 await a.rejects(f.worker().tick(),/PROVIDER_REFERENCE_CONFLICT/);
 a.equal(confirms,0);
 f.provider.lookup=async()=>({status:'awaiting_confirmation',intent:f.intent});
 await a.rejects(f.worker().tick(),/AMBIGUOUS_ACK/);
 a.equal(confirms,1);
 a.equal(f.counts().acks,0);
});
