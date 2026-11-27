'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openReconciliationArchive,verifyReconciliationBackup}=require('../../financial-sandbox/reconciliation-archive.cjs');
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

test('independent backup restores clean and discrepant receipts after source loss',()=>fixture(({store,config})=>{
 const first=store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 const second=store.record({internalPages:pages('internal'),providerPages:pages('provider',[row('r1',101),row('r2')],'provider-2')});
 const destination=config.path+'.backup.sqlite';
 const manifest=store.backup(destination);
 a.deepEqual([manifest.snapshots,manifest.receipts],[3,2]);
 a.deepEqual(verifyReconciliationBackup({environment:'sandbox',path:destination,expected:manifest}),manifest);
 const restored=openReconciliationArchive({...config,path:destination});
 try{
  a.deepEqual(restored.get(first.receipt.receiptId),first.receipt);
  a.deepEqual(restored.get(second.receipt.receiptId),second.receipt);
  a.equal(restored.record({internalPages:pages('internal'),providerPages:pages('provider')}).status,'duplicate');
 }finally{restored.close();}
 a.throws(()=>store.backup(destination),/EEXIST/);
 a.throws(()=>store.backup(config.path),/EEXIST/);
 a.throws(()=>verifyReconciliationBackup({environment:'production',path:destination,expected:manifest}),/SANDBOX_ONLY/);
}));
test('backup rejects missing, malformed or changed manifest and a logically different archive',()=>fixture(({store,config})=>{
 store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 const destination=config.path+'.backup.sqlite',manifest=store.backup(destination);
 const check=(path,expected)=>verifyReconciliationBackup({environment:'sandbox',path,expected});
 a.throws(()=>check(destination,{}),/INVALID_MANIFEST/);
 a.throws(()=>check(destination,{...manifest,sha256:'0'.repeat(64)}),/BACKUP_MISMATCH/);
 a.throws(()=>check(destination+'.missing.sqlite',manifest),/ARCHIVE_MISSING/);
 const restored=openReconciliationArchive({...config,path:destination});
 try{restored.record({internalPages:pages('internal'),providerPages:pages('provider',[row('r1',101),row('r2')],'provider-2')});}
 finally{restored.close();}
 a.throws(()=>check(destination,manifest),/BACKUP_MISMATCH/);
}));
test('verification detects missing linked snapshot despite a structurally healthy database',()=>fixture(({store,config})=>{
 store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 const destination=config.path+'.backup.sqlite',manifest=store.backup(destination);
 const db=new DatabaseSync(destination);
 try{db.exec("DROP TRIGGER snapshots_no_delete; DELETE FROM snapshots WHERE source='provider'");}
 finally{db.close();}
 a.throws(()=>verifyReconciliationBackup({environment:'sandbox',path:destination,expected:manifest}),/ARCHIVE_CORRUPT/);
}));


test('opt-in export verifies against archived receipt after independent backup and restart',()=>fixture(({store,config,reopen})=>{
 const x=store.recordWithBundle({internalPages:pages('internal'),providerPages:pages('provider')});
 a.equal(x.status,'recorded');a.deepEqual(store.verifyArchivedBundle(x.receipt.receiptId,x.bundle),x.receipt);
 store=reopen();
 const duplicate=store.recordWithBundle({internalPages:pages('internal',[row('r2'),row('r1')]),providerPages:pages('provider')});
 a.equal(duplicate.status,'duplicate');a.deepEqual(duplicate.bundle,x.bundle);
 const backup=config.path+'.export-backup.sqlite',manifest=store.backup(backup);
 verifyReconciliationBackup({environment:'sandbox',path:backup,expected:manifest});
 const restored=openReconciliationArchive({...config,path:backup});
 try{
  const bundle=JSON.parse(JSON.stringify(x.bundle));
  a.deepEqual(restored.verifyArchivedBundle(x.receipt.receiptId,bundle),x.receipt);
  a.deepEqual(restored.counts(),{snapshots:2,receipts:1});
  bundle.providerPages[0].rows[0].amountMinor=999;
  a.throws(()=>restored.verifyArchivedBundle(x.receipt.receiptId,bundle),/EVIDENCE_MISMATCH/);
  a.throws(()=>restored.verifyArchivedBundle('0'.repeat(64),x.bundle),/RECEIPT_NOT_FOUND/);
  a.deepEqual(restored.counts(),{snapshots:2,receipts:1});
 }finally{restored.close();}
}));
test('export rejects invalid cuts and reused identities without changing archive; disputes remain verifiable',()=>fixture(({store})=>{
 const invalid=pages('provider');invalid[0].complete=false;
 a.throws(()=>store.recordWithBundle({internalPages:pages('internal'),providerPages:invalid}),/INVALID_PAGE/);
 a.deepEqual(store.counts(),{snapshots:0,receipts:0});
 const x=store.recordWithBundle({internalPages:pages('internal'),providerPages:pages('provider',[row('r1'),row('r2',101)])});
 a.equal(x.receipt.clean,false);a.equal(x.receipt.matchedConfirmedNetMinor,null);
 a.deepEqual(store.verifyArchivedBundle(x.receipt.receiptId,x.bundle),x.receipt);
 a.throws(()=>store.recordWithBundle({internalPages:pages('internal',[row('r1')],'new-internal'),providerPages:pages('provider')}),/SNAPSHOT_ID_CONFLICT/);
 a.deepEqual(store.counts(),{snapshots:2,receipts:1});
}));
test('bundle check detects altered receipt summary even when stored evidence still matches',()=>fixture(({store,config})=>{
 const x=store.recordWithBundle({internalPages:pages('internal'),providerPages:pages('provider')});
 const db=new DatabaseSync(config.path);
 try{
  db.exec('DROP TRIGGER receipts_no_update');
  const changed={...x.receipt,matchedConfirmedNetMinor:{USD:'999',HNL:'0'}};
  db.prepare('UPDATE receipts SET summary=? WHERE receipt_id=?').run(JSON.stringify(changed),x.receipt.receiptId);
 }finally{db.close();}
 a.throws(()=>store.verifyArchivedBundle(x.receipt.receiptId,x.bundle),/RECEIPT_MISMATCH/);
}));

test('new archives reject replacement even with recursive triggers disabled',()=>fixture(({store,config})=>{
 const x=store.recordWithBundle({internalPages:pages('internal'),providerPages:pages('provider')});
 const db=new DatabaseSync(config.path);
 try{
  db.exec('PRAGMA recursive_triggers=OFF');
  for(const sql of ['INSERT OR REPLACE INTO snapshots SELECT * FROM snapshots','INSERT OR REPLACE INTO receipts SELECT * FROM receipts','INSERT OR REPLACE INTO metadata SELECT * FROM metadata',"UPDATE metadata SET value='changed'",'DELETE FROM metadata'])
   a.throws(()=>db.exec(sql),/IMMUTABLE_ARCHIVE/);
 }finally{db.close();}
 a.deepEqual(store.verifyArchivedBundle(x.receipt.receiptId,x.bundle),x.receipt);
}));
test('backup never publishes an inconsistent source and preserves existing destination bytes',()=>fixture(({store,config})=>{
 const fs=require('node:fs'),{dirname}=require('node:path');
 store.record({internalPages:pages('internal'),providerPages:pages('provider')});
 const destination=config.path+'.backup.sqlite';
 fs.writeFileSync(destination,'preserve existing');
 a.throws(()=>store.backup(destination),/EEXIST/);
 a.equal(fs.readFileSync(destination,'utf8'),'preserve existing');
 fs.unlinkSync(destination);
 const db=new DatabaseSync(config.path);
 try{db.exec("DROP TRIGGER snapshots_no_delete; DELETE FROM snapshots WHERE source='provider'");}
 finally{db.close();}
 a.throws(()=>store.backup(destination),/ARCHIVE_CORRUPT/);
 a.equal(fs.existsSync(destination),false);
 a.equal(fs.readdirSync(dirname(destination)).some(x=>x.startsWith('.mwd-archive-')),false);
}));
