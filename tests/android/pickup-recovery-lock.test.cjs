const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const start=source.indexOf('async function recoverPendingPickup(');
const end=source.indexOf('async function loadPickupOrders(',start);
const body=source.slice(start,end);
const ref='469bea32-c0b9-43bd-b2e4-cadcaf0a3883';
function harness(read){
 const busy={current:false},pending={current:null};let rpc=0,reads=0,error='',amount='';
 const api=new Function('userId','isCurrentUser','pickupBusyRef','setPickupBusy','setPickupPendingError','AsyncStorage','pendingPickupStorageKey','parsePendingPickup','pickupPendingRef','setPendingPickup','setPickupAmount','formatMWD','pickupPendingError','pickupAmount','amountToCents','supabase',body+';return {recoverPendingPickup,createDemoPickup};')('A',id=>id==='A',busy,()=>{},v=>{error=v;},{getItem:async()=>{reads++;return read();}},id=>id,JSON.parse,pending,()=>{},v=>{amount=v;},v=>(v/100).toFixed(2),'','10',()=>1000,{rpc:async()=>{rpc++;throw Error('unexpected');}});
 return {...api,state:()=>({busy:busy.current,pending:pending.current,rpc,reads,error,amount})};
}
test('pending pickup read blocks creation and duplicate recovery',async()=>{
 let release;const h=harness(()=>new Promise(resolve=>{release=resolve;}));
 const p=h.recoverPendingPickup();await h.createDemoPickup();await h.recoverPendingPickup();
 assert.equal(h.state().reads,1);assert.equal(h.state().rpc,0);
 release(JSON.stringify({id:ref,cents:1000}));await p;
 assert.equal(h.state().pending.id,ref);assert.equal(h.state().amount,'10.00');assert.equal(h.state().busy,false);
});
test('failed pickup read releases lock and reports error',async()=>{
 const h=harness(()=>{throw Error('storage');});await h.recoverPendingPickup();
 assert.ok(h.state().error);assert.equal(h.state().busy,false);assert.equal(h.state().rpc,0);
});
test('empty pickup read releases lock',async()=>{
 const h=harness(()=>null);await h.recoverPendingPickup();assert.equal(h.state().busy,false);assert.equal(h.state().pending,null);
});
test('switching accounts clears conversion inputs',()=>{
 const p=source.indexOf('setPreparedUserId(userId || null);');
 const r=source.lastIndexOf('setSwapWallet(null);',p);
 assert.ok(r>=0 && source.slice(r,p).includes("setSwapFrom('COIN');") && source.slice(r,p).includes("setSwapAmount('');"));
});
