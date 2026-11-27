'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {createMockProvider}=require('../../financial-sandbox/mock-provider.cjs');
const {openDurableProvider}=require('../../financial-sandbox/durable-provider.cjs');
const {openAuthenticatedMulticurrencyLab}=require('../../financial-sandbox/authenticated-multicurrency-lab.cjs');
const {parseSyntheticEnvelope}=require('../../financial-sandbox/strict-synthetic-envelope.cjs');
const secret='synthetic-json-representation-fixture-only',clock=()=>1000000;
const intent={mode:'sandbox',orderId:'order1',reference:'order1-funding',kind:'funding',currency:'USD',amountMinor:10150};
const signature=(raw,domain='')=>createHmac('sha256',secret).update(domain).update(raw).digest('hex');
function altered(raw,field){
 return [
  raw.replace('"'+field+'":10150','"'+field+'":1,"'+field+'":10150'),
  raw.replace('"'+field+'":10150','"'+field+'":1,"\\u'+field.charCodeAt(0).toString(16).padStart(4,'0')+field.slice(1)+'":10150'),
  raw.replace('"'+field+'":10150','"'+field+'":10150.000000000000001'),
  raw.replace('"'+field+'":10150','"'+field+'":1.015e4'),
  ' '+raw
 ];
}
test('compact synthetic objects accepted, ambiguous representations rejected',()=>{
 a.deepEqual(parseSyntheticEnvelope('{"z":2,"a":1}'),{z:2,a:1});
 for(const raw of ['{} ','null','[]','{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"n":-0}','{"n":1.00000000000000001}','{"n":1e0}','{"n":1e400}','{"n":1,"nested":{"v":1,"v":2}}'])a.throws(()=>parseSyntheticEnvelope(raw),/INVALID_ENVELOPE/);
});
test('both synthetic remittance adapters reject valid signatures over ambiguous amount encodings',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mwd-strict-provider-'));
 const providers=[createMockProvider({secret,clock}),openDurableProvider({environment:'sandbox',path:join(dir,'provider.sqlite'),initialize:true,secret,clock})];
 t.after(()=>{providers[1].close();rmSync(dir,{recursive:true,force:true});});
 for(const p of providers){
  await p.submit(intent);
  const e=p.event(intent.reference,'funding_confirmed','strict-event');
  for(const raw of altered(e.raw,'amountMinor')){
   a.notEqual(raw,e.raw);
   a.throws(()=>p.verifyEvent(raw,signature(raw)),/INVALID_ENVELOPE/);
  }
  a.equal(p.verifyEvent(e.raw,e.signature).amountMinor,10150);
 }
});
test('multicurrency signed ambiguous amount never consumes an event or changes balance',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mwd-strict-multi-'));
 const store=openAuthenticatedMulticurrencyLab({environment:'sandbox',path:join(dir,'ledger.sqlite'),initialize:true,secret,clock});
 try{
  store.create({mode:'sandbox',id:'order1',principalUsdMinor:10000,feeUsdMinor:150,payoutHnlMinor:250000});
  const raw=JSON.stringify({mode:'sandbox',provider:'mock-multicurrency',timestamp:clock(),event:{mode:'sandbox',orderId:'order1',eventId:'strict-event',type:'funding_confirmed',usdMinor:10150}});
  const domain='mwd:synthetic-multicurrency:v1\n';
  for(const bad of altered(raw,'usdMinor')){
   a.notEqual(bad,raw);
   a.throws(()=>store.receive({raw:bad,signature:signature(bad,domain)}),/INVALID_ENVELOPE/);
  }
  a.equal(store.counts().events,0);
  a.equal(store.get('order1').state,'awaiting_funding');
  a.equal(store.receive({raw,signature:signature(raw,domain)}).projection.state,'funded');
  a.equal(store.counts().events,1);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
