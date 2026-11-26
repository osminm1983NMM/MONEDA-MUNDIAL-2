'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {reconcilePagedCut}=require('../../financial-sandbox/reconcile-paged-cut.cjs');
const row=(n,kind='funding',amountMinor=100)=>({mode:'sandbox',reference:'ref'+n,kind,currency:kind==='payout'?'HNL':'USD',amountMinor,status:'confirmed'});
const rows=[row(1),row(2,'payout',2500),row(3,'refund',25)];
const pages=(source,groups=[rows.slice(0,2),rows.slice(2)],extra={})=>groups.map((r,i)=>({
 mode:'sandbox',source,snapshotId:source+'-snapshot',scope:'US-HN:all-funding-payout-refund',
 start:'2026-11-26T00:00:00.000Z',end:'2026-11-27T00:00:00.000Z',capturedAt:'2026-11-27T00:01:00.000Z',
 declaredCount:groups.flat().length,pageCount:groups.length,index:i,cursor:i?'cursor-'+i:null,
 nextCursor:i===groups.length-1?null:'cursor-'+(i+1),complete:i===groups.length-1,rows:r,...extra
}));
const run=(internalPages=pages('internal'),providerPages=pages('provider'))=>reconcilePagedCut({environment:'sandbox',internalPages,providerPages});
test('independent paginated extracts reconcile exactly and identify both inputs',()=>{
 const x=run();a.equal(x.clean,true);a.deepEqual(x.matchedConfirmedNetMinor,{USD:'75',HNL:'-2500'});
 a.equal(x.evidence.internal.snapshotId,'internal-snapshot');a.equal(x.evidence.provider.snapshotId,'provider-snapshot');
 a.match(x.evidence.internal.sha256,/^[0-9a-f]{64}$/);a.notEqual(x.evidence.internal.sha256,x.evidence.provider.sha256);
});
test('canonical content evidence is independent of row order and page boundaries',()=>{
 const x=run(),y=run(pages('internal',[[...rows].reverse()]),pages('provider',[[rows[2]],[rows[0]],[rows[1]]]));
 a.deepEqual(x.evidence,y.evidence);a.equal(y.clean,true);
});
test('amount or snapshot identity changes evidence even when other fields match',()=>{
 const x=run(),y=run(undefined,pages('provider',[[row(1,'funding',101),...rows.slice(1)]]));
 a.equal(y.clean,false);a.ok(y.issues.some(i=>i.code==='VALUE_MISMATCH'));a.notEqual(x.evidence.provider.sha256,y.evidence.provider.sha256);
 const z=run(undefined,pages('provider',[rows],{snapshotId:'another'}));a.equal(z.clean,true);a.notEqual(x.evidence.provider.sha256,z.evidence.provider.sha256);
});
test('missing page, invalid cursor, swapped source and different cut cannot pass',()=>{
 const incomplete=pages('provider');incomplete.pop();
 const cursor=pages('provider');cursor[1].cursor='wrong';
 for(const [p,code] of [[incomplete,'INVALID_ENVELOPE'],[cursor,'INVALID_PAGE'],[pages('internal'),'INVALID_SOURCE']]){
  const x=run(undefined,p);a.equal(x.clean,false);a.equal(x.evidence,null);a.equal(x.matchedConfirmedNetMinor,null);a.deepEqual(x.issues,[{code,side:'provider'}]);
 }
 const x=run(undefined,pages('provider',[rows],{start:'2026-11-26T01:00:00.000Z'}));
 a.equal(x.clean,false);a.equal(x.matchedConfirmedNetMinor,null);a.equal(x.issues[0].code,'CUT_MISMATCH');
});
test('large independently paginated cut reconciles beyond the legacy 10000 row limit only in memory',()=>{
 const big=Array.from({length:10001},(_,i)=>row(i));
 const x=run(pages('internal',[big.slice(0,10000),big.slice(10000)]),pages('provider',[big.slice(0,5000),big.slice(5000)]));
 a.equal(x.clean,true);a.equal(x.matchedConfirmedNetMinor.USD,'1000100');a.equal(x.evidence.provider.declaredCount,10001);
 a.throws(()=>reconcilePagedCut({environment:'production'}),/SANDBOX_ONLY/);
});
