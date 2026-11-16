const test = require('node:test');
const assert = require('node:assert/strict');
const { keyForUser, readPending, savePending, clearPending } = require('../remittancePendingStorage');
const userId='a1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const otherId='b1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const requestId='c1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const item={version:1,userId,kind:'create',requestId,destination:'HN',cents:10000,createdAt:'2026-11-16T21:00:00.000Z'};
function memoryStore(){const map=new Map();return {map,async getItem(k){return map.has(k)?map.get(k):null;},async setItem(k,v){map.set(k,v);},async removeItem(k){map.delete(k);}};}

test('saved request survives adapter re-reads',async()=>{
 const store=memoryStore();await savePending(store,userId,item);assert.deepEqual(await readPending(store,userId),item);
});
test('separate account cannot read another account pending request',async()=>{
 const store=memoryStore();await savePending(store,userId,item);assert.equal(await readPending(store,otherId),null);
 assert.notEqual(keyForUser(userId),keyForUser(otherId));
});
test('blocks replacing a pending request with a different id',async()=>{
 const store=memoryStore();await savePending(store,userId,item);
 await assert.rejects(savePending(store,userId,{...item,requestId:otherId}),/Existe una solicitud pendiente/);
 assert.deepEqual(await readPending(store,userId),item);
});
test('refuses corrupt local content without overwriting it',async()=>{
 const store=memoryStore();store.map.set(keyForUser(userId),'bad json');
 await assert.rejects(readPending(store,userId),/dañada/);
 await assert.rejects(savePending(store,userId,item),/dañada/);
});
test('refuses storage failures and does not silently report success',async()=>{
 const store=memoryStore();store.setItem=async()=>{throw new Error('disk full');};
 await assert.rejects(savePending(store,userId,item),/disk full/);
});
test('checks stored value after writing',async()=>{
 const store=memoryStore();store.setItem=async()=>{};
 await assert.rejects(savePending(store,userId,item),/No se confirmó el guardado/);
});
test('only clears matching request id and verifies deletion',async()=>{
 const store=memoryStore();await savePending(store,userId,item);
 await assert.rejects(clearPending(store,userId,otherId),/otra solicitud/);
 assert.equal(await clearPending(store,userId,requestId),true);
 assert.equal(await readPending(store,userId),null);
});
test('does not silently clear when deletion fails',async()=>{
 const store=memoryStore();await savePending(store,userId,item);store.removeItem=async()=>{};
 await assert.rejects(clearPending(store,userId,requestId),/No se confirmó la eliminación/);
});
