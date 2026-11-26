'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {reconcileStatements:r}=require('../../financial-sandbox/reconcile-statements.cjs');
const row=(reference='f1',kind='funding',status='confirmed',amountMinor=10150)=>({mode:'sandbox',reference,kind,status,amountMinor,currency:kind==='payout'?'HNL':'USD'});
const run=(internal,statement,complete=true)=>r({environment:'sandbox',internal,statement,complete});
test('reject non sandbox and invalid snapshots',()=>{a.throws(()=>r({environment:'production'}),/SANDBOX_ONLY/);a.throws(()=>run(null,[]),/INVALID_SNAPSHOT/);});
test('same complete snapshot matches and totals remain per currency',()=>{const rows=[row(),row('p1','payout','confirmed',250000),row('f2'),row('r2','refund')];const x=run(rows,[...rows].reverse());a.equal(x.clean,true);a.deepEqual(x.matchedConfirmedNetMinor,{USD:'10150',HNL:'-250000'});});
test('missing and unknown references independently detected',()=>{const x=run([row()],[row('f2')]);a.equal(x.clean,false);a.deepEqual(x.issues.map(i=>i.code),['MISSING_PROVIDER','UNKNOWN_PROVIDER']);});
test('duplicate references fail even when identical and are not totaled',()=>{const x=run([row()],[row(),row()]);a.equal(x.clean,false);a.equal(x.issues[0].code,'DUPLICATE_REFERENCE');a.equal(x.matchedConfirmedNetMinor.USD,'0');});
test('amount mismatch never counts as reconciled',()=>{const x=run([row()],[row('f1','funding','confirmed',999)]);a.equal(x.issues[0].code,'VALUE_MISMATCH');a.equal(x.matchedConfirmedNetMinor.USD,'0');});
test('status mismatch and pending prevent clean reconciliation',()=>{a.equal(run([row()],[row('f1','funding','pending')]).issues[0].code,'STATUS_MISMATCH');const p=row('f1','funding','pending');a.equal(run([p],[p]).issues[0].code,'UNRESOLVED_PENDING');});
test('failed matched events produce no confirmed cash flow',()=>{const f=row('f1','funding','failed');a.deepEqual(run([f],[f]),{mode:'sandbox',clean:true,issues:[],matchedConfirmedNetMinor:{USD:'0',HNL:'0'}});});
test('invalid currencies, amounts, modes and missing completeness fail closed',()=>{for(const p of [{currency:'EUR'},{amountMinor:1.5},{mode:'production'}])a.equal(run([],[{...row(),...p}]).issues[0].code,'INVALID_ROW');a.equal(run([],[],false).clean,false);});
test('integer totals beyond safe-number range remain exact',()=>{const rows=[row('a','funding','confirmed',Number.MAX_SAFE_INTEGER),row('b','funding','confirmed',Number.MAX_SAFE_INTEGER)];a.equal(run(rows,rows).matchedConfirmedNetMinor.USD,'18014398509481982');});

test('malformed duplicates never contribute to matched totals, regardless of row order or side',()=>{
  const good=row('a'), bad={...good,amountMinor:-1}, independent=row('b');
  for(const pair of [[good,bad],[bad,good]]) {
    for(const side of ['internal','provider']) {
      const clean=[good,independent], ambiguous=[...pair,independent];
      const x=side==='internal'?run(ambiguous,clean):run(clean,ambiguous);
      a.equal(x.clean,false);
      a.ok(x.issues.some(i=>i.code==='INVALID_ROW'&&i.side===side));
      a.ok(x.issues.some(i=>i.code==='DUPLICATE_REFERENCE'&&i.reference==='a'&&i.side===side));
      a.equal(x.matchedConfirmedNetMinor.USD,String(independent.amountMinor));
    }
  }
});
test('malformed duplicates on both sides cannot mask an ambiguous payout',()=>{
  const good=row('p','payout','confirmed',250000), bad={...good,currency:'USD'};
  const x=run([good,bad],[bad,good]);
  a.equal(x.clean,false);
  a.deepEqual(x.matchedConfirmedNetMinor,{USD:'0',HNL:'0'});
  a.equal(x.issues.filter(i=>i.code==='DUPLICATE_REFERENCE').length,2);
});
