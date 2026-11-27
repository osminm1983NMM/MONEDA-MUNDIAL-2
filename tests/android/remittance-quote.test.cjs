'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');const fs=require('node:fs');
const {centsFromInput,parseCountries,parseQuote,makeRequestGate,withQuoteDeadline}=require('../../remittance-quote');
const c={code:'HN',name:'Honduras',demoAvailable:true,realPaymentsEnabled:false};
const expected={country:'HN',method:'bank',cents:10000};
const q={status:'simulation_only',realPaymentsEnabled:false,origin:'US',destination:'HN',sourceCurrency:'USD',destinationCurrency:'HNL',method:'bank',amountCents:10000,feeCents:100,totalPayCents:10100,fxRate:null,receiverAmountCents:null};
test('parse valid dollar amounts exactly',()=>{for(const [v,n] of [['1',100],['1,01',101],['100000.00',10000000],[' 12.34 ',1234]])a.equal(centsFromInput(v),n);});
test('reject malformed and out-of-range amounts',()=>{for(const v of ['0.99','100000.01','1e2','1.001','-1','1,000.00','',null])a.equal(centsFromInput(v),null);});
test('only enabled simulation destinations retained',()=>a.deepEqual(parseCountries([c,{...c,code:'CA',name:'Canadá',demoAvailable:false}]),[{code:'HN',name:'Honduras'}]));
test('reject live flag, duplicate country and empty catalog',()=>{for(const v of [[{...c,realPaymentsEnabled:true}],[c,c],[],[{...c,demoAvailable:false}]])a.throws(()=>parseCountries(v));});
test('HNL quote displays fee and total but not exchange estimate',()=>{const r=parseQuote({...q,costEstimateCents:20,illustrativeMarginCents:80},expected);a.equal(r.totalPayCents,10100);a.equal(r.receiverAmountCents,null);a.equal('costEstimateCents' in r,false);});
test('USD quote must match exact input',()=>{a.equal(parseQuote({...q,destinationCurrency:'USD',fxRate:1,receiverAmountCents:10000},expected).receiverAmountCents,10000);a.throws(()=>parseQuote({...q,destinationCurrency:'USD',fxRate:1,receiverAmountCents:10001},expected));});
test('reject stale request, wrong fee, unsupported currency and unsafe FX',()=>{for(const patch of [{destination:'GT'},{method:'card'},{amountCents:10001},{totalPayCents:1},{feeCents:-1},{realPaymentsEnabled:true},{status:'ok'},{fxRate:25},{receiverAmountCents:250000},{destinationCurrency:'HNLX'}])a.throws(()=>parseQuote({...q,...patch},expected));});
test('request gate rejects concurrent click and invalidates stale response',()=>{const g=makeRequestGate(),x=g.begin();a.equal(g.begin(),null);g.invalidate();const y=g.begin();a.equal(g.isLatest(x),false);a.equal(g.finish(x),false);a.equal(g.isLatest(y),true);a.equal(g.finish(y),true);});
test('UI calls only read-only simulation RPCs and fences actor',()=>{const s=fs.readFileSync('RemittanceQuoteScreen.js','utf8'),app=fs.readFileSync('App.js','utf8');a.deepEqual([...s.matchAll(/supabase\.rpc\('([^']+)'/g)].map(x=>x[1]),['mwd_world_countries_demo','mwd_quote_international_demo']);a.match(s,/gate\.isLatest\(token\)&&activeRef\.current\(\)/);a.match(s,/return\(\)=>gate\.invalidate\(\)/);a.match(app,/isCurrentUser\(userId\) && authEventUserRef\.current === userId/);a.match(s,/No cambia tu saldo/);});

test('quote deadline preserves a successful result and synchronous errors',async()=>{
 let signal;
 a.deepEqual(await withQuoteDeadline(s=>{signal=s;return {data:[c]};},1000),{data:[c]});
 a.equal(signal.aborted,false);
 await a.rejects(withQuoteDeadline(()=>{throw Error('network');},1000),/network/);
});
test('non-cooperative quote read times out, aborts and ignores late fulfillment',{timeout:1000},async()=>{
 let signal,complete;
 const gate=makeRequestGate(),old=gate.begin();
 await a.rejects(withQuoteDeadline(s=>{signal=s;return new Promise(resolve=>{complete=resolve;});},10),/QUOTE_TIMEOUT/);
 a.equal(signal.aborted,true);a.equal(gate.finish(old),true);
 const next=gate.begin();complete({data:q});await new Promise(resolve=>setImmediate(resolve));
 a.equal(gate.isLatest(old),false);a.equal(gate.isLatest(next),true);
});
test('late rejection after timeout is observed',{timeout:1000},async()=>{
 let rejectLate;
 await a.rejects(withQuoteDeadline(()=>new Promise((_,reject)=>{rejectLate=reject;}),10),/QUOTE_TIMEOUT/);
 rejectLate(Error('late'));await new Promise(resolve=>setImmediate(resolve));
});
test('both read-only RPCs use the bounded request wrapper and abort signal',()=>{
 const s=fs.readFileSync('RemittanceQuoteScreen.js','utf8');
 a.equal((s.match(/await withQuoteDeadline\(signal=>supabase\.rpc\(/g)||[]).length,2);
 a.equal((s.match(/\.abortSignal\(signal\)/g)||[]).length,2);
});
