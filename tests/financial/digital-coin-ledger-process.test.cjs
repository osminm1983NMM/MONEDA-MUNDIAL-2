'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {spawn}=require('node:child_process');
const modulePath=require.resolve('../../financial-sandbox/digital-coin-ledger.cjs');
const {openDigitalCoinLedger:open}=require(modulePath);
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const batch=q=>[
 {eventId:q+'-q',kind:'quote_created',at:10,quoteId:q,owner:'alice',direction:'digital_to_coin',digitalMinor:'700',coinMinor:'300',expiresAt:100},
 {eventId:q+'-a',kind:'quote_accepted',at:10,quoteId:q,owner:'alice'}
];
const finish=q=>({eventId:q+'-end',kind:'swap_confirmed',at:11,quoteId:q});
const worker = [
 "const [mod,path,payload,mode]=process.argv.slice(1);",
 "const ledger=require(mod).openDigitalCoinLedger({environment:'sandbox',path});",
 "process.on('message',m=>{if(m!=='go')return;try{",
 " const result=ledger.appendBatch(JSON.parse(payload));",
 " if(mode==='lost-response')process.exit(73);",
 " ledger.close();process.send({status:result.status,added:result.added},()=>process.disconnect());",
 "}catch(e){ledger.close();process.send({error:e.code||e.message},()=>process.disconnect());}});",
 "process.send({ready:true});"
].join('\n');
function start(path,events,mode='normal'){
 const child=spawn(process.execPath,['-e',worker,modulePath,path,JSON.stringify(events),mode],{stdio:['ignore','ignore','ignore','ipc']});
 let readyResolve,readyReject,exitResolve,exitReject,result;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const done=new Promise((resolve,reject)=>{exitResolve=resolve;exitReject=reject;});
 // Both promises have handlers even when startup fails before the caller awaits them.
 ready.catch(()=>{});done.catch(()=>{});
 const timeout=setTimeout(()=>{child.kill('SIGKILL');readyReject(Error('WORKER_TIMEOUT'));exitReject(Error('WORKER_TIMEOUT'));},10000);
 child.on('message',m=>{if(m.ready)readyResolve();else result=m;});
 child.once('error',e=>{clearTimeout(timeout);readyReject(e);exitReject(e);});
 child.once('exit',(code,signal)=>{
  clearTimeout(timeout);readyReject(Error('WORKER_EXIT_BEFORE_READY'));
  exitResolve({code,signal,result});
 });
 return {ready,done,go:()=>child.send('go'),kill:()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}};
}
async function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-swap-mp-')),options={environment:'sandbox',path:join(dir,'ledger.sqlite')};
 const ledger=open({...options,initialize:true,seed});ledger.close();
 const workers=[];
 try{await fn(options,(...args)=>{const w=start(options.path,...args);workers.push(w);return w;});}
 finally{for(const w of workers)w.kill();await Promise.allSettled(workers.map(w=>w.done));fs.rmSync(dir,{recursive:true,force:true});}
}
test('two independent processes race for the same available balance: exactly one commits',async()=>fixture(async(options,startWorker)=>{
 const a1=startWorker(batch('a')),b1=startWorker(batch('b'));
 await Promise.all([a1.ready,b1.ready]);a1.go();b1.go();
 const outcomes=await Promise.all([a1.done,b1.done]);
 a.deepEqual(outcomes.map(x=>x.code),[0,0]);
 a.equal(outcomes.filter(x=>x.result?.status==='applied').length,1);
 a.equal(outcomes.filter(x=>x.result?.error==='INSUFFICIENT_AVAILABLE').length,1);
 const ledger=open(options);
 try{
  const x=ledger.get();
  a.deepEqual(ledger.counts(),{events:2});
  a.equal(x.digital.accounts.find(x=>x.owner==='alice').available,'300');
  a.equal(x.digital.accounts.find(x=>x.owner==='alice').reserved,'700');
  a.equal(x.coin.accounts.find(x=>x.owner==='treasury').reserved,'300');
  a.equal(x.quotes.length,1);
 }finally{ledger.close();}
}));
test('committed conversion with lost response is recovered by retry after process exit',async()=>fixture(async(options,startWorker)=>{
 const events=[...batch('a'),finish('a')];
 const w=startWorker(events,'lost-response');await w.ready;w.go();
 const outcome=await w.done;a.equal(outcome.code,73);a.equal(outcome.result,undefined);
 const ledger=open(options);
 try{
  const retry=ledger.appendBatch(events);a.equal(retry.status,'duplicate');a.equal(retry.added,0);
  a.deepEqual(ledger.counts(),{events:3});
  a.equal(retry.projection.digital.accounts.find(x=>x.owner==='alice').available,'300');
  a.equal(retry.projection.coin.accounts.find(x=>x.owner==='alice').available,'300');
  a.equal(retry.projection.quotes[0].state,'confirmed');
 }finally{ledger.close();}
}));
test('abrupt exit with an uncommitted SQLite write does not expose partial events',async()=>fixture(async(options)=>{
 // Direct SQLite fault injection: this tests database rollback, not a hook in the public API.
 const e=batch('a')[0],payload=JSON.stringify(Object.fromEntries(Object.keys(e).sort().map(k=>[k,e[k]])));
 const script="const [path,payload]=process.argv.slice(1);const db=new (require('node:sqlite').DatabaseSync)(path);db.exec('BEGIN IMMEDIATE');db.prepare('INSERT INTO events(event_id,payload) VALUES(?,?)').run('a-q',payload);process.exit(74);";
 await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['-e',script,options.path,payload],{stdio:'ignore'});
  const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('WORKER_TIMEOUT'));},10000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.once('exit',code=>{clearTimeout(timer);if(code===74)resolve();else reject(Error('UNEXPECTED_EXIT_'+code));});
 });
 const ledger=open(options);
 try{a.deepEqual(ledger.counts(),{events:0});a.equal(ledger.get().quotes.length,0);
  a.equal(ledger.appendBatch([...batch('a'),finish('a')]).status,'applied');
  a.deepEqual(ledger.counts(),{events:3});
 }finally{ledger.close();}
}));
