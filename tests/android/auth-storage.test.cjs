'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthStorage,createMemoryAuthStorage}=require('../../auth-storage');
const key='sb-test-auth-token', verifier=key+'-code-verifier';
function fixture(){
 const native=new Map(),plain=new Map([[key,'old plaintext token'],[verifier,'old verifier'],['mwd_pending_operation:fixture','keep']]);
 let failure=null;
 const check=(op,k)=>{if(failure&&failure(op,k)){failure=null;throw Error('synthetic storage failure');}};
 const secure={async getItemAsync(k){check('get',k);return native.get(k)??null;},async setItemAsync(k,v){check('set',k);assert.ok(Buffer.byteLength(v)<=1600);native.set(k,v);},async deleteItemAsync(k){check('delete',k);native.delete(k);}};
 const legacy={async getAllKeys(){return [...plain.keys()];},async removeItem(k){check('legacy',k);plain.delete(k);}};
 return {native,plain,secure,legacy,storage:createAuthStorage(secure,legacy,key),fail:f=>failure=f,reopen:()=>createAuthStorage(secure,legacy,key)};
}
test('upgrade discards legacy auth only; retains pending operation',async()=>{
 const f=fixture();f.plain.set('sb-other-auth-token','other project');assert.equal(await f.storage.getItem(key),null);assert.equal(f.plain.has(verifier),false);assert.equal(f.plain.get('sb-other-auth-token'),'other project');assert.equal(await f.storage.getItem(verifier),null);
 assert.equal(f.plain.has(key),false);assert.equal(f.plain.has(verifier),false);assert.equal(f.plain.get('mwd_pending_operation:fixture'),'keep');
});
test('long Unicode session survives reopening and no plaintext write',async()=>{
 const f=fixture(),value='😀á漢z'.repeat(1800);await f.storage.setItem(key,value);
 assert.equal(await f.reopen().getItem(key),value);assert.equal(f.plain.has(key),false);
});
test('separate verifier and session keys',async()=>{
 const f=fixture();await f.storage.setItem(key,'session');await f.storage.setItem(verifier,'pkce');
 await f.storage.removeItem(verifier);assert.equal(await f.storage.getItem(key),'session');assert.equal(await f.storage.getItem(verifier),null);
});
test('interrupted replacement leaves previous committed value',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');
 f.fail((op,k)=>op==='set'&&k.endsWith('.1.1'));await assert.rejects(f.storage.setItem(key,'x'.repeat(1000)));
 assert.equal(await f.reopen().getItem(key),'old');await f.storage.setItem(key,'new');assert.equal(await f.storage.getItem(key),'new');
});
test('pointer failure cannot expose partially committed value',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');
 f.fail((op,k)=>op==='set'&&k.endsWith('.active'));await assert.rejects(f.storage.setItem(key,'new'));assert.equal(await f.storage.getItem(key),'old');
});
test('cleanup failure after commit does not undo new value',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');
 f.fail((op,k)=>op==='delete'&&k.endsWith('.0.0'));await f.storage.setItem(key,'new');
 assert.equal(await f.storage.getItem(key),'new');await f.storage.removeItem(key);assert.equal(f.native.size,0);
});
test('deletion is authoritative even if encrypted chunk cleanup fails',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');f.fail((op,k)=>op==='delete'&&k.endsWith('.0.0'));
 await assert.rejects(f.storage.removeItem(key));assert.equal(await f.reopen().getItem(key),null);await f.storage.removeItem(key);assert.equal(f.native.size,0);
});
test('failed legacy purge fails closed and can retry',async()=>{
 const f=fixture();f.fail(op=>op==='legacy');await assert.rejects(f.storage.getItem(key));assert.equal(f.plain.has(key),true);
 assert.equal(await f.storage.getItem(key),null);assert.equal(f.plain.has(key),false);
});
test('missing encrypted chunk fails closed, no plaintext fallback',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');f.native.delete('mwd.auth.v1.'+key+'.0.0');
 await assert.rejects(f.storage.getItem(key),/Missing secure auth chunk/);
});
test('FIFO orders writes and logout',async()=>{
 const f=fixture();await Promise.all([f.storage.setItem(key,'first'),f.storage.setItem(key,'second'),f.storage.removeItem(key)]);
 assert.equal(await f.storage.getItem(key),null);
});
test('oversized value rejected without overwriting committed value',async()=>{
 const f=fixture();await f.storage.setItem(key,'old');await assert.rejects(f.storage.setItem(key,'x'.repeat(51201)),/too large/);assert.equal(await f.storage.getItem(key),'old');
});
test('web auth is volatile',async()=>{
 const s=createMemoryAuthStorage();await s.setItem(key,'value');assert.equal(await s.getItem(key),'value');assert.equal(await createMemoryAuthStorage().getItem(key),null);
});
test('secure adapter wired into native auth and not pending operation storage',()=>{
 const fs=require('node:fs');const app=fs.readFileSync('App.js','utf8');const cfg=JSON.parse(fs.readFileSync('app.json','utf8'));
 assert.match(app,/storage: authStorage/);assert.match(app,/createAuthStorage\(SecureStore, NativeAsyncStorage, AUTH_STORAGE_KEY\)/);assert.match(app,/createPendingStorage\(NativeAsyncStorage\)/);
 assert.ok(cfg.expo.plugins.includes('expo-secure-store'));
});

test('refuses keys outside project auth namespace',async()=>{const f=fixture();assert.throws(()=>f.storage.getItem('mwd_pending_operation:fixture'),/Invalid auth storage key/);assert.equal(f.plain.get('mwd_pending_operation:fixture'),'keep');});
