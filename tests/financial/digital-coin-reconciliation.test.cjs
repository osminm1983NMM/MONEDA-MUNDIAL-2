'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const fs=require('node:fs');const {join}=require('node:path');const {tmpdir}=require('node:os');
const {openDigitalCoinLedger:open}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const {compareDigitalCoinCut:compare}=require('../../financial-sandbox/digital-coin-reconciliation.cjs');
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const events=[
 {eventId:'q',kind:'quote_created',at:10,quoteId:'q',owner:'alice',direction:'digital_to_coin',digitalMinor:'200',coinMinor:'300',expiresAt:100},
 {eventId:'a',kind:'quote_accepted',at:11,quoteId:'q',owner:'alice'},
 {eventId:'c',kind:'swap_confirmed',at:12,quoteId:'q'}
];
// Manually specified independent fixtures, not constructed from the ledger output.
const report=(asset,source,reportId)=>({mode:'sandbox',cutId:'cut-1',scope:'all-test-accounts',source,reportId,asset,complete:true});
function reports(){return {
 reserve:{...report('USD','reserve-bank-fixture','bank-1'),eligibleMinor:'2000'},
 digital:{...report('DIGITAL_TEST','digital-custody-fixture','digital-1'),outstandingMinor:'2000',balances:[{owner:'alice',totalMinor:'800'},{owner:'treasury',totalMinor:'1200'}]},
 coin:{...report('COIN_TEST','coin-custody-fixture','coin-1'),outstandingMinor:'1000',balances:[{owner:'treasury',totalMinor:'700'},{owner:'alice',totalMinor:'300'}]}
};}
function fixture(fn,base=seed,history=events){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-asset-recon-'));
 const ledger=open({environment:'sandbox',path:join(dir,'ledger.sqlite'),initialize:true,seed:base});
 try{if(history.length)ledger.appendBatch(history);const snapshot=ledger.reconciliationSnapshot();
 const run=(r=reports(),extra={})=>compare({environment:'sandbox',cutId:'cut-1',snapshot,reports:r,...extra});
 fn({ledger,snapshot,run});}
 finally{ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('frozen joint snapshot matches independent synthetic balances and reserve with no writes',()=>fixture(({ledger,snapshot,run})=>{
 const x=run();a.equal(x.clean,true);a.deepEqual(x.issues,[]);a.equal(x.internalSha256,snapshot.manifest.sha256);
 a.deepEqual(ledger.counts(),{events:3});
}));
test('same aggregate supply but swapped ownership is not clean',()=>fixture(({run})=>{
 const r=reports();r.coin.balances=[{owner:'treasury',totalMinor:'800'},{owner:'alice',totalMinor:'200'}];
 const x=run(r);a.equal(x.clean,false);a.equal(x.issues.length,2);a.ok(x.issues.every(i=>i.code==='OWNER_BALANCE_MISMATCH'));
}));
test('missing owners, unknown owners, custody total and reserve deficit are detected',()=>fixture(({run})=>{
 const r=reports();r.digital.balances=[{owner:'treasury',totalMinor:'1200'},{owner:'bob',totalMinor:'700'}];
 r.coin.outstandingMinor='900';r.reserve.eligibleMinor='1999';
 const x=run(r);a.equal(x.clean,false);
 for(const code of ['RESERVE_MISMATCH','INSUFFICIENT_COVERAGE','CUSTODY_TOTAL_MISMATCH','SUPPLY_MISMATCH','MISSING_CUSTODY_BALANCE','UNKNOWN_CUSTODY_BALANCE'])a.ok(x.issues.some(i=>i.code===code),code);
}));
test('pending redemption remains an obligation even if issued supply and custody match',()=>fixture(({run})=>{
 const r=reports();r.reserve.eligibleMinor='1999';r.digital.balances=[{owner:'alice',totalMinor:'600'},{owner:'treasury',totalMinor:'1000'}];r.digital.outstandingMinor='1600';
 r.coin.balances=[{owner:'treasury',totalMinor:'1000'}];
 const x=run(r);a.ok(x.issues.some(i=>i.code==='INSUFFICIENT_COVERAGE'&&i.internalMinor==='2000'));
}, {...seed,digitalEvents:[...seed.digitalEvents,{eventId:'rh',kind:'redemption_reserved',owner:'alice',amountMinor:'400',redemptionId:'r'},{eventId:'rb',kind:'burn_confirmed',redemptionId:'r'}]},[]));
test('incomplete or different cuts, duplicate owners and invalid amounts fail closed',()=>fixture(({run})=>{
 for(const patch of [{complete:false},{cutId:'other'},{asset:'COIN_TEST'},{scope:'partial'},{reportId:'bank-1'}]){
  const r=reports();Object.assign(r.digital,patch);a.throws(()=>run(r),/INCOMPLETE_OR_MISMATCHED_REPORT/);
 }
 const r=reports();r.coin.balances.push({...r.coin.balances[0]});a.throws(()=>run(r),/DUPLICATE_OWNER/);
 const bad=reports();bad.reserve.eligibleMinor=2000;a.throws(()=>run(bad),/INVALID_AMOUNT/);
 a.throws(()=>run(reports(),{environment:'production'}),/SANDBOX_ONLY/);
}));


test('gated ledger requires a clean current cut, rejects stale evidence, preserves mode across restart',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-asset-gate-')),options={environment:'sandbox',path:join(dir,'ledger.sqlite')};
 let ledger=open({...options,initialize:true,seed,requireReconciliation:true});
 try{
  const initial=reports();
  initial.digital.balances=[{owner:'alice',totalMinor:'1000'},{owner:'treasury',totalMinor:'1000'}];
  initial.coin.balances=[{owner:'treasury',totalMinor:'1000'}];
  const proof={cutId:'cut-1',internalSha256:ledger.manifest().sha256,reports:initial};
  a.equal(ledger.reconciliationRequired(),true);
  a.throws(()=>ledger.appendBatch(events),/RECONCILIATION_REQUIRED/);
  const bad=structuredClone(proof);bad.reports.reserve.eligibleMinor='1999';
  a.throws(()=>ledger.appendBatch(events,bad),/RECONCILIATION_DISCREPANCY/);
  const incomplete=structuredClone(proof);incomplete.reports.coin.complete=false;
  a.throws(()=>ledger.appendBatch(events,incomplete),/INCOMPLETE_OR_MISMATCHED_REPORT/);
  a.deepEqual(ledger.counts(),{events:0});
  const other=open(options);
  try{
   a.equal(other.appendBatch(events,proof).status,'applied');
   const next={...events[0],eventId:'q2',quoteId:'q2',at:20,expiresAt:100};
   a.throws(()=>ledger.appendBatch([next],proof),/STALE_RECONCILIATION/);
   a.equal(ledger.appendBatch(events).status,'duplicate');
   ledger.close();ledger=open(options);a.equal(ledger.reconciliationRequired(),true);
   a.throws(()=>open({...options,requireReconciliation:false}),/INVALID_GATE_CONFIGURATION/);
   a.throws(()=>ledger.appendBatch([next]),/RECONCILIATION_REQUIRED/);
   const current={cutId:'cut-1',internalSha256:ledger.manifest().sha256,reports:reports()};
   a.equal(ledger.appendBatch([next],current).status,'applied');
   a.deepEqual(ledger.counts(),{events:4});
   const copy=join(dir,'copy.sqlite');ledger.backup(copy);
   const restored=open({...options,path:copy});
   try{a.equal(restored.reconciliationRequired(),true);a.deepEqual(restored.counts(),{events:4});}
   finally{restored.close();}
  }finally{other.close();}
 }finally{ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('legacy fixture remains explicitly ungated for isolated tests',()=>fixture(({ledger})=>{
 a.equal(ledger.reconciliationRequired(),false);
}));
