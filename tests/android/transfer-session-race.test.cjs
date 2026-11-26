const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const body=source.slice(source.indexOf('async function recoverPendingOperation('),source.indexOf('function prepareOperation('));
const id='469bea32-c0b9-43bd-b2e4-cadcaf0a3883';
const recipient='MWD-0123456789ABCDEF';
const pending={id,userId:'A',type:'transfer',cents:100,code:recipient};
function harness(){
 let actor='A',reads=[],calls=[],removed=[],alerts=[],visible=[],notices=[],busyStates=[];
 const busy={current:false},ref={current:null};
 const api=new Function('userId','isCurrentUser','busyRef','pendingRef','AsyncStorage','pendingOperationStorageKey','parsePendingOperation','setBusy','setPendingOperation','setPendingOperationRecoveryError','setSyncNotice','supabase','refreshAccount','setAmount','setRecipientCode','setScreen','message','isDefinitiveRpcRejection','uniqueRequestId',body+';return {recoverPendingOperation,executeOperation};')('A',id=>id===actor,busy,ref,{getItem:()=>new Promise(resolve=>reads.push(resolve)),setItem:async()=>{},removeItem:async k=>removed.push(k)},id=>id,JSON.parse,v=>busyStates.push(v),v=>visible.push(v),()=>{},v=>notices.push(v),{rpc:(name,args)=>new Promise(resolve=>calls.push({name,args,resolve}))},async()=>true,()=>{},()=>{},()=>{},(...v)=>alerts.push(v),()=>false,()=>id);
 return {...api,reads,calls,removed,alerts,visible,notices,busyStates,busy,ref,cycle:()=>{actor='B';busy.current=false;ref.current=null;actor='A';}};
}
test('A-B-A obsolete recovery read cannot replace new reference or unlock',async()=>{
 const h=harness(),old=h.recoverPendingOperation();h.cycle();const fresh=h.recoverPendingOperation();
 h.reads[0](JSON.stringify(pending));await old;
 assert.equal(h.calls.length,0);assert.equal(h.visible.length,0);assert.ok(h.busy.current);
 h.reads[1](null);await fresh;assert.equal(h.busy.current,false);
});
test('A-B-A obsolete transfer response cannot remove reference or notify',async()=>{
 const h=harness(),old=h.executeOperation('transfer',100,recipient);
 h.reads[0](null);await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls[0].name,'mwd_transfer_demo');h.cycle();
 const fresh=h.recoverPendingOperation();
 h.calls[0].resolve({data:{status:'ok',operation_id:id}});await old;
 assert.equal(h.removed.length,0);assert.equal(h.alerts.length,0);assert.ok(h.busy.current);
 h.reads[1](JSON.stringify(pending));await Promise.resolve();
 h.calls[1].resolve({data:{status:'processed',kind:'transfer',amountCents:100,recipientCode:recipient}});await fresh;
 assert.deepEqual(h.removed,['A']);assert.equal(h.busy.current,false);
});
test('A-B-A obsolete contribution error does not release current lock or display alert',async()=>{
 const h=harness(),old=h.executeOperation('contribution',100);
 h.reads[0](null);await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls[0].name,'mwd_contribute_demo');h.cycle();
 const fresh=h.recoverPendingOperation();h.calls[0].resolve({error:{message:'old network error'}});await old;
 assert.equal(h.alerts.length,0);assert.ok(h.busy.current);h.reads[1](null);await fresh;
 assert.equal(h.busy.current,false);
});
test('A-B-A obsolete status response must not delete persistent pending reference',async()=>{
 const h=harness(),old=h.recoverPendingOperation();
 h.reads[0](JSON.stringify(pending));await Promise.resolve();
 h.cycle();const fresh=h.recoverPendingOperation();
 h.calls[0].resolve({data:{status:'processed',kind:'transfer',amountCents:100,recipientCode:recipient}});await old;
 assert.equal(h.removed.length,0);assert.ok(h.busy.current);
 h.reads[1](null);await fresh;assert.equal(h.busy.current,false);
});
