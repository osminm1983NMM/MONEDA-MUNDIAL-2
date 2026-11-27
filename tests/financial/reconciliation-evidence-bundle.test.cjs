'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {createReconciliationBundle:create,verifyReconciliationBundle:verify}=require('../../financial-sandbox/reconciliation-evidence-bundle.cjs');
const row=(reference,amountMinor=100,kind='funding',status='confirmed')=>({mode:'sandbox',reference,kind,currency:kind==='payout'?'HNL':'USD',amountMinor,status});
const pages=(source,groups,extra={})=>groups.map((rows,index)=>({mode:'sandbox',source,snapshotId:source+'-1',scope:'US-HN:all-funding-payout-refund',
 start:'2026-11-26T00:00:00.000Z',end:'2026-11-27T00:00:00.000Z',capturedAt:'2026-11-27T00:01:00.000Z',
 declaredCount:groups.reduce((n,g)=>n+g.length,0),pageCount:groups.length,index,cursor:index?'c'+index:null,
 nextCursor:index===groups.length-1?null:'c'+(index+1),complete:index===groups.length-1,rows,...extra}));
const run=(i,p=i)=>create({environment:'sandbox',internalPages:pages('internal',i),providerPages:pages('provider',p)});
const check=(bundle,expectedEvidence)=>verify({environment:'sandbox',bundle,expectedEvidence});
test('normalized evidence survives JSON round trip; stable order and pages',()=>{
 const rows=[row('z',30,'refund'),row('a',100),row('p',500,'payout')];
 const x=run([rows.slice(0,1),rows.slice(1)],[rows.slice().reverse()]),y=run([rows.slice().reverse()]);
 a.deepEqual(x.bundle,y.bundle);a.deepEqual(x.result,y.result);
 a.deepEqual(check(JSON.parse(JSON.stringify(x.bundle)),x.result.evidence),x.result);
 a.deepEqual(x.result.matchedConfirmedNetMinor,{USD:'70',HNL:'-500'});
});
test('changed amount, reference, status, metadata or both extracts cannot match independently retained evidence',()=>{
 const x=run([[row('a')]]);
 for(const alter of [
  b=>{b.providerPages[0].rows[0].amountMinor=101;},
  b=>{b.internalPages[0].rows[0].reference='b';},
  b=>{b.providerPages[0].rows[0].status='failed';},
  b=>{b.providerPages[0].snapshotId='new';},
  b=>{for(const side of ['internalPages','providerPages'])b[side][0].rows[0].amountMinor=101;}
 ]){
  const b=structuredClone(x.bundle);alter(b);
  a.throws(()=>check(b,x.result.evidence),/EVIDENCE_MISMATCH/);
 }
 a.throws(()=>check(x.bundle,undefined),/INVALID_EXPECTED_EVIDENCE/);
 const e=structuredClone(x.result.evidence);e.internal.declaredCount=2;
 a.throws(()=>check(x.bundle,e),/EVIDENCE_MISMATCH/);
});
test('disputed or pending cuts preserve evidence but never expose partial totals',()=>{
 const x=run([[row('a'),row('b')]],[[row('a'),row('b',101)]]);
 a.equal(x.result.clean,false);a.equal(x.result.matchedConfirmedNetMinor,null);
 a.deepEqual(check(x.bundle,x.result.evidence),x.result);
 const y=run([[row('a'),row('b',100,'funding','pending')]]);
 a.equal(y.result.clean,false);a.equal(y.result.matchedConfirmedNetMinor,null);
});
test('invalid pages, swapped source, duplicates and non-sandbox are rejected',()=>{
 const x=run([[row('a')]]);
 const b=structuredClone(x.bundle);b.providerPages[0].complete=false;
 a.throws(()=>check(b,x.result.evidence),/INVALID_PAGE/);
 a.throws(()=>run([[row('a'),row('a')]]),/DUPLICATE_REFERENCE/);
 a.throws(()=>check({...x.bundle,providerPages:x.bundle.internalPages},x.result.evidence),/INVALID_SOURCE/);
 a.throws(()=>verify({environment:'production'}),/SANDBOX_ONLY/);
 a.throws(()=>create({environment:'production'}),/SANDBOX_ONLY/);
});
test('empty and 10001-row normalized cuts round-trip without changing SQL capacity',()=>{
 for(const rows of [[],Array.from({length:10001},(_,i)=>row('r'+i))]){
  const groups=rows.length>10000?[rows.slice(0,10000),rows.slice(10000)]:[rows];
  const x=run(groups);a.equal(x.result.clean,true);
  a.equal(x.bundle.internalPages.length,groups.length);
  a.deepEqual(check(JSON.parse(JSON.stringify(x.bundle)),x.result.evidence),x.result);
 }
});
