const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const a=source.indexOf('function createPendingStorage('),b=source.indexOf('const AsyncStorage = createPendingStorage(',a);
assert.ok(a>=0&&b>a);
const make=new Function(source.slice(a,b)+';return createPendingStorage;')();
function harness(){
 const values=new Map(),calls=[],gates=[];
 const store=make({
   getItem:async k=>{calls.push('get:'+k);return values.get(k)??null;},
   setItem:(k,v)=>{calls.push('set:'+k);return new Promise((resolve,reject)=>gates.push({finish:()=>{values.set(k,v);resolve();},reject}));},
   removeItem:k=>{calls.push('remove:'+k);return new Promise((resolve,reject)=>gates.push({finish:()=>{values.delete(k);resolve();},reject}));},
 });
 return {store,values,calls,gates};
}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('pending reference read waits for earlier write after account reentry',async()=>{
 const h=harness(),k='mwd_pending_operation:A';const write=h.store.setItem(k,'old-ref');const read=h.store.getItem(k);
 await tick();assert.deepEqual(h.calls,['set:'+k]);h.gates[0].finish();await write;assert.equal(await read,'old-ref');
});
test('older removal cannot erase a later write to the same key',async()=>{
 const h=harness(),k='mwd_pending_pickup:A';h.values.set(k,'old');
 const remove=h.store.removeItem(k),write=h.store.setItem(k,'new');
 await tick();assert.deepEqual(h.calls,['remove:'+k]);h.gates[0].finish();await remove;await tick();assert.deepEqual(h.calls,['remove:'+k,'set:'+k]);h.gates[1].finish();await write;assert.equal(await h.store.getItem(k),'new');
});
test('storage failure does not poison next read or swallow error',async()=>{
 const h=harness(),k='mwd:pending-swap:A';h.values.set(k,'preserved');
 const failed=h.store.removeItem(k);const rejection=assert.rejects(failed,/disk/);const read=h.store.getItem(k);
 await tick();h.gates[0].reject(Error('disk'));await rejection;assert.equal(await read,'preserved');
});
test('different accounts and operation types do not block each other',async()=>{
 const h=harness(),k='mwd_pending_operation:A',other='mwd_pending_operation:B',swap='mwd:pending-swap:A';
 h.values.set(other,'B');h.values.set(swap,'quote');const write=h.store.setItem(k,'A');await tick();
 assert.equal(await h.store.getItem(other),'B');assert.equal(await h.store.getItem(swap),'quote');h.gates[0].finish();await write;
});
test('all pending reference methods queue and authentication uses separate secure storage',()=>{
 assert.ok(source.includes('const AsyncStorage = createPendingStorage(NativeAsyncStorage);'));
 assert.ok(source.includes('storage: authStorage,'));
 assert.ok(source.includes('createAuthStorage(SecureStore, NativeAsyncStorage, AUTH_STORAGE_KEY)'));
 assert.ok(!source.includes('storage: AsyncStorage,'));
});
