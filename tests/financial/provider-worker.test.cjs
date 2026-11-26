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
