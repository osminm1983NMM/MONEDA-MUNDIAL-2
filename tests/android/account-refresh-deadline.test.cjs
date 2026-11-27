'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const {createQuoteReader}=require('../../remittance-quote');
const source=fs.readFileSync('App.js','utf8');
const start=source.indexOf('  async function refreshAccount('),end=source.indexOf('  async function authenticate(',start);
a.ok(start>=0&&end>start);
function fixture(){
 const calls=[],updates=[],notices=[],messages=[],sync=[],version={current:0},current={current:'A'};
 const supabase={from(table){
  const q={select(){return q;},eq(){return q;},or(){return q;},order(){return q;},limit(){return q;},single(){return q;},maybeSingle(){return q;},abortSignal(signal){q.signal=signal;return q;},then(resolve,reject){return new Promise((ok,no)=>calls.push({table,signal:q.signal,resolve:ok,reject:no})).then(resolve,reject);}};
  return q;
 }};
 const read=createQuoteReader(1);
 const refresh=new Function('userId','isCurrentUser','currentUserRef','refreshAccountVersionRef','setSyncing','setSyncNotice','supabase','setWallet','setOperations','setAdminRole','message','syncErrorMessage','readAccountWithDeadline',source.slice(start,end)+'return refreshAccount;')('A',id=>id===current.current,current,version,v=>sync.push(v),v=>notices.push(v),supabase,v=>updates.push(['wallet',v]),v=>updates.push(['operations',v]),v=>updates.push(['role',v]),(...v)=>messages.push(v),e=>e?.message,(fn)=>read(fn,25));
 const complete=offset=>{calls[offset].resolve({data:{balance_cents:100}});calls[offset+1].resolve({data:[]});calls[offset+2].resolve({data:{role:null}});};
 return {refresh,calls,updates,notices,messages,sync,version,current,complete};
}
test('wallet read times out even when transport ignores abort, and permits recovery after settlement',{timeout:2000},async()=>{
 const f=fixture();
 a.equal(await f.refresh(),false);a.equal(f.calls.length,3);a.ok(f.calls.every(x=>x.signal.aborted));
 a.equal(f.sync.at(-1),false);a.equal(f.updates.length,0);
 a.equal(await f.refresh(),false);a.equal(f.calls.length,3);
 f.complete(0);await new Promise(resolve=>setImmediate(resolve));
 const next=f.refresh();await new Promise(resolve=>setImmediate(resolve));f.complete(3);
 a.equal(await next,true);a.equal(f.updates.length,3);a.equal(f.sync.at(-1),false);
});
test('wallet read rejection does not release capacity while sibling reads remain pending',{timeout:2000},async()=>{
 const f=fixture(),p=f.refresh();await new Promise(resolve=>setImmediate(resolve));
 f.calls[0].reject(Error('network'));a.equal(await p,false);
 a.equal(await f.refresh(),false);a.equal(f.calls.length,3);
 f.calls[1].resolve({data:[]});f.calls[2].resolve({data:null});
 await new Promise(resolve=>setImmediate(resolve));
 a.equal(f.updates.length,0);
});
test('superseded wallet response cannot update a different account',{timeout:2000},async()=>{
 const f=fixture(),p=f.refresh();await new Promise(resolve=>setImmediate(resolve));
 f.current.current='B';f.version.current++;f.complete(0);
 a.equal(await p,undefined);a.equal(f.updates.length,0);
});
