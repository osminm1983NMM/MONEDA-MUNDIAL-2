'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openReconciliationArchive}=require('../../financial-sandbox/reconciliation-archive.cjs');
const row=(reference,amountMinor=100)=>({mode:'sandbox',reference,kind:'funding',currency:'USD',amountMinor,status:'confirmed'});
const pages=(source,rows=[row('r1'),row('r2')],snapshotId=source+'-1')=>[{mode:'sandbox',source,snapshotId,scope:'US-HN:all-funding-payout-refund',start:'2026-11-26T00:00:00.000Z',end:'2026-11-27T00:00:00.000Z',capturedAt:'2026-11-27T00:01:00.000Z',declaredCount:rows.length,pageCount:1,index:0,cursor:null,nextCursor:null,complete:true,rows}];
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'mwd-reconciliation-'));
 const config={environment:'sandbox',path:join(dir,'archive.sqlite')};
 let store;
 try{store=openReconciliationArchive({...config,initialize:true});fn({config,store,reopen(){store.close();store=openReconciliationArchive(config);return store;}});}
 finally{if(store)store.close();rmSync(dir,{recursive:true,force:true});}
}
test('durable receipt survives reopening and identical reordered pages are idempotent',()=>fixture(({store,reopen})=>{
 const result=store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 a.equal(result.status,'recorded');a.equal(result.receipt.clean,true);a.equal(result.receipt.matchedConfirmedNetMinor.USD,'200');
 store=reopen();a.deepEqual(store.get(result.receipt.receiptId),result.receipt);
 const duplicate=store.record({internalPages:pages('internal',[row('r2'),row('r1')]),providerPages:pages('provider')});
 a.equal(duplicate.status,'duplicate');a.deepEqual(duplicate.receipt,result.receipt);a.deepEqual(store.counts(),{snapshots:2,receipts:1});
}));
test('changed content under reused snapshot ID rolls back the whole pair',()=>fixture(({store})=>{
 store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 a.throws(()=>store.record({internalPages:pages('internal',[row('r1')],'internal-new'),providerPages:pages('provider',[row('r1',101)])}),/SNAPSHOT_ID_CONFLICT/);
 a.deepEqual(store.counts(),{snapshots:2,receipts:1});
 const accepted=store.record({internalPages:pages('internal',[row('r1')],'internal-new'),providerPages:pages('provider',[row('r1')],'provider-new')});
 a.equal(accepted.status,'recorded');a.equal(accepted.receipt.clean,true);
}));
test('invalid page set is not archived and discrepancy receipts never expose partial totals',()=>fixture(({store})=>{
 const bad=pages('provider');bad[0].declaredCount=3;
 a.equal(store.record({internalPages:pages('internal'),providerPages:bad}).status,'rejected');a.deepEqual(store.counts(),{snapshots:0,receipts:0});
 const result=store.record({internalPages:pages('internal'),providerPages:pages('provider',[row('r1'),row('r2',101)])});
 a.equal(result.receipt.clean,false);a.deepEqual(result.receipt.issueCounts,{VALUE_MISMATCH:1});a.equal(result.receipt.matchedConfirmedNetMinor,null);
 a.deepEqual(store.get(result.receipt.receiptId),result.receipt);
}));
test('archive refuses production, implicit creation and overwrite; ordinary update/delete are blocked',()=>fixture(({store,config})=>{
 a.throws(()=>openReconciliationArchive({...config,environment:'production'}),/SANDBOX_ONLY/);
 a.throws(()=>openReconciliationArchive({...config,path:config.path+'.missing.sqlite'}),/ARCHIVE_MISSING/);
 a.throws(()=>openReconciliationArchive({...config,initialize:true}),/EEXIST/);
 store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 const db=new DatabaseSync(config.path);
 try{for(const sql of ["UPDATE snapshots SET fingerprint='changed'","DELETE FROM snapshots","UPDATE receipts SET summary='changed'","DELETE FROM receipts"])a.throws(()=>db.exec(sql),/IMMUTABLE_ARCHIVE/);}
 finally{db.close();}
 a.deepEqual(store.counts(),{snapshots:2,receipts:1});
}));
