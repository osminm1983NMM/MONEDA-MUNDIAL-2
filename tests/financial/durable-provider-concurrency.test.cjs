'use strict';
// Offline synthetic provider only. Two independent processes share a disposable SQLite file.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {spawn}=require('node:child_process');
const {openDurableProvider}=require('../../financial-sandbox/durable-provider.cjs');
const modulePath=resolve(__dirname,'../../financial-sandbox/durable-provider.cjs');
const intent={mode:'sandbox',orderId:'race1',reference:'race1-funding',kind:'funding',currency:'USD',amountMinor:10150};
const childCode=`
const [modulePath,config,operation]=JSON.parse(process.argv[1]);
const provider=require(modulePath).openDurableProvider(config);
process.once('message',async message=>{
 if(message!=='start') process.exit(3);
 let result;
 try {
  const value=operation.type==='submit'
    ? await provider.submit(operation.intent)
    : provider.event(operation.reference,operation.eventType,operation.eventId);
  result={ok:true,value};
 } catch(e) { result={ok:false,code:e.code||e.message}; }
 provider.close();
 process.send({result},()=>process.disconnect());
});
process.send({ready:true});
`;
function setup(t){
 const dir=mkdtempSync(join(tmpdir(),'mwd-provider-concurrency-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const config={environment:'sandbox',path:join(dir,'provider.sqlite'),secret:'synthetic-concurrency-test-key-only'};
 const p=openDurableProvider({...config,initialize:true});p.close();
 return config;
}
async function race(config,operations){
 const children=[];
 const entries=operations.map(op=>{
  const child=spawn(process.execPath,['-e',childCode,JSON.stringify([modulePath,config,op])],{stdio:['ignore','ignore','pipe','ipc']});
  children.push(child);
  let readyResolve,readyReject,doneResolve,doneReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
  // Suppress premature unhandled rejection while waiting at the start barrier.
  done.catch(()=>{});ready.catch(()=>{});
  let result,stderr='';
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const fail=error=>{readyReject(error);doneReject(error);};
  child.on('error',fail);
  child.on('message',m=>{if(m.ready)readyResolve();if(m.result)result=m.result;});
  child.on('close',(code,signal)=>{
   if(code!==0||!result){fail(Error('child failed: '+code+' '+signal+' '+stderr));return;}
   doneResolve(result);
  });
  return {child,ready,done};
 });
 let timeout;
 try {
  return await Promise.race([
   (async()=>{
    await Promise.all(entries.map(x=>x.ready));
    for(const x of entries)x.child.send('start');
    return Promise.all(entries.map(x=>x.done));
   })(),
   new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('provider race timeout')),15000);})
  ]);
 } finally {
  clearTimeout(timeout);
  for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
 }
}
const submit=i=>({type:'submit',intent:i});
const event=(eventType,eventId)=>({type:'event',reference:intent.reference,eventType,eventId});
test('parallel identical submissions create exactly one durable reference',async t=>{
 const f=setup(t);
 const results=await race(f,[submit(intent),submit(intent)]);
 assert.ok(results.every(r=>r.ok&&r.value.accepted===true&&r.value.reference===intent.reference));
 const p=openDurableProvider(f);
 try{assert.deepEqual(p.submissions(),[intent]);}finally{p.close();}
});
test('parallel conflicting submissions permit exactly one payload',async t=>{
 const f=setup(t),other={...intent,amountMinor:9999};
 const results=await race(f,[submit(intent),submit(other)]);
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.deepEqual(results.filter(r=>!r.ok),[{ok:false,code:'PROVIDER_IDEMPOTENCY_CONFLICT'}]);
 const p=openDurableProvider(f);
 try{assert.deepEqual(p.submissions(),[results[0].ok?intent:other]);}finally{p.close();}
});
test('parallel identical event IDs return the exact same persisted signed event',async t=>{
 const f=setup(t);let p=openDurableProvider(f);await p.submit(intent);p.close();
 const op=event('funding_confirmed','race-event');
 const results=await race(f,[op,op]);
 assert.ok(results.every(r=>r.ok));
 assert.deepEqual(results[0].value,results[1].value);
 p=openDurableProvider(f);
 try{assert.deepEqual(p.event(intent.reference,op.eventType,op.eventId),results[0].value);
 assert.equal(p.verifyEvent(results[0].value.raw,results[0].value.signature).amountMinor,10150);}finally{p.close();}
});
test('parallel contradictory event reuse preserves only the winning event ID',async t=>{
 const f=setup(t);let p=openDurableProvider(f);await p.submit(intent);p.close();
 const ops=[event('funding_confirmed','race-conflict'),event('funding_failed','race-conflict')];
 const results=await race(f,ops);
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.deepEqual(results.filter(r=>!r.ok),[{ok:false,code:'EVENT_ID_CONFLICT'}]);
 const win=results[0].ok?0:1;
 p=openDurableProvider(f);
 try{assert.deepEqual(p.event(intent.reference,ops[win].eventType,ops[win].eventId),results[win].value);
 assert.throws(()=>p.event(intent.reference,ops[1-win].eventType,ops[1-win].eventId),/EVENT_ID_CONFLICT/);}finally{p.close();}
});
