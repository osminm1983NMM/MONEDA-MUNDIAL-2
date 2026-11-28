'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {openReconciliationArchive}=require('../../financial-sandbox/reconciliation-archive.cjs');
const {saveStoredBundle:save,readStoredBundle:read,auditStoredBundles:audit}=require('../../financial-sandbox/reconciliation-bundle-storage.cjs');
const page=source=>[{mode:'sandbox',source,snapshotId:source+'-1',scope:'US-HN:all-funding-payout-refund',
 start:'2026-11-26T00:00:00.000Z',end:'2026-11-27T00:00:00.000Z',capturedAt:'2026-11-27T00:01:00.000Z',
 declaredCount:1,pageCount:1,index:0,cursor:null,nextCursor:null,complete:true,
 rows:[{mode:'sandbox',reference:'r1',kind:'funding',currency:'USD',amountMinor:100,status:'confirmed'}]}];
function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-bundle-')),directory=join(dir,'bundles');
 fs.mkdirSync(directory,{mode:0o700});
 const config={environment:'sandbox',path:join(dir,'archive.sqlite')};
 let archive=openReconciliationArchive({...config,initialize:true});
 try{
  const x=archive.recordWithBundle({internalPages:page('internal'),providerPages:page('provider')});
  const options={environment:'sandbox',directory,archive,receiptId:x.receipt.receiptId,bundle:x.bundle};
  fn({options,x,path:join(directory,x.receipt.receiptId+'.json'),reopen(){archive.close();archive=openReconciliationArchive(config);options.archive=archive;}});
 }finally{archive.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('persist normalized file exclusively, verify after restart, retry idempotently',()=>fixture(({options,x,path,reopen})=>{
 a.equal(save(options).status,'stored');
 a.equal(fs.statSync(path).mode&0o777,0o600);
 a.deepEqual(fs.readdirSync(options.directory),[x.receipt.receiptId+'.json']);
 reopen();
 a.deepEqual(read(options),{bundle:x.bundle,receipt:x.receipt});
 a.equal(save(options).status,'duplicate');
 a.deepEqual(options.archive.counts(),{snapshots:2,receipts:1});
}));
test('altered or corrupt existing files are never overwritten',()=>fixture(({options,path})=>{
 save(options);
 const changed=structuredClone(options.bundle);changed.providerPages[0].rows[0].amountMinor=101;
 fs.writeFileSync(path,JSON.stringify(changed));
 a.throws(()=>read(options),/EVIDENCE_MISMATCH/);
 a.throws(()=>save(options),/BUNDLE_FILE_CONFLICT/);
 a.equal(fs.readFileSync(path,'utf8'),JSON.stringify(changed));
 fs.writeFileSync(path,'bad');
 a.throws(()=>read(options),/INVALID_BUNDLE_FILE/);
 a.throws(()=>save(options),/BUNDLE_FILE_CONFLICT/);
 a.equal(fs.readFileSync(path,'utf8'),'bad');
}));
test('wrong receipt, unverified export and non-sandbox cannot create files',()=>fixture(({options})=>{
 const changed=structuredClone(options.bundle);changed.internalPages[0].rows[0].amountMinor=101;
 a.throws(()=>save({...options,bundle:changed}),/EVIDENCE_MISMATCH/);
 a.throws(()=>save({...options,receiptId:'0'.repeat(64)}),/RECEIPT_NOT_FOUND/);
 a.throws(()=>save({...options,environment:'production'}),/SANDBOX_ONLY/);
 a.deepEqual(fs.readdirSync(options.directory),[]);
}));
test('refuse symbolic link target and unexpected extra fields on disk',()=>fixture(({options,path})=>{
 const other=join(options.directory,'other');
 fs.writeFileSync(other,'untouched');fs.symlinkSync(other,path);
 a.throws(()=>save(options),/ELOOP/);a.throws(()=>read(options),/ELOOP/);
 a.equal(fs.readFileSync(other,'utf8'),'untouched');
 fs.unlinkSync(path);
 const b=structuredClone(options.bundle);b.internalPages[0].rows[0].extra='unexpected';
 fs.writeFileSync(path,JSON.stringify(b));
 a.throws(()=>read(options),/NONCANONICAL_BUNDLE_FILE/);
}));

test('offline audit reports missing legacy receipts, orphan files, pending writes and invalid bundles without mutation',()=>fixture(({options,x,path})=>{
 const legacy=page('provider');legacy[0].snapshotId='provider-legacy';
 const old=options.archive.record({internalPages:page('internal'),providerPages:legacy});
 save(options);
 const orphan='0'.repeat(64),pending='.pending-12345678-1234-1234-1234-123456789abc';
 fs.writeFileSync(join(options.directory,orphan+'.json'),'orphan');
 fs.writeFileSync(join(options.directory,pending),'partial');
 fs.writeFileSync(join(options.directory,'unexpected.txt'),'keep');
 const result=audit(options);
 a.equal(result.completeCoverage,false);
 a.deepEqual(result.verified,[x.receipt.receiptId]);
 a.deepEqual(result.missing,[old.receipt.receiptId]);
 a.deepEqual(result.orphaned,[orphan]);
 a.deepEqual(result.pending,[pending]);a.deepEqual(result.unexpected,['unexpected.txt']);
 const before=fs.readdirSync(options.directory).sort();
 fs.writeFileSync(path,'corrupt');
 const again=audit(options);
 a.deepEqual(again.invalid,[{receiptId:x.receipt.receiptId,code:'INVALID_BUNDLE_FILE'}]);
 a.deepEqual(fs.readdirSync(options.directory).sort(),before);
 a.deepEqual(options.archive.counts(),{snapshots:3,receipts:2});
}));
test('offline coverage passes for complete verified inventory after restart and refuses incomplete scan',()=>fixture(({options,x,reopen})=>{
 a.deepEqual(audit(options).missing,[x.receipt.receiptId]);
 save(options);reopen();
 a.equal(audit(options).completeCoverage,true);
 a.deepEqual(audit(options).verified,[x.receipt.receiptId]);
 fs.writeFileSync(join(options.directory,'extra'),'keep');
 a.throws(()=>audit({...options,limit:1}),/INVENTORY_LIMIT_EXCEEDED/);
 a.throws(()=>audit({...options,limit:0}),/INVALID_INVENTORY_LIMIT/);
 a.throws(()=>audit({...options,environment:'production'}),/SANDBOX_ONLY/);
}));

test('bounded bundle reads reject files growing or shrinking after initial size validation',t=>fixture(({options,path})=>{
 save(options);
 const bytes=fs.readFileSync(path),original=fs.readSync;
 for(const change of ['grow','shrink']){
  let mutated=false;
  const mocked=t.mock.method(fs,'readSync',function(fd,buffer,offset,length,position){
   if(!mutated){
    mutated=true;
    if(change==='grow')fs.appendFileSync(path,'x');
    else fs.truncateSync(path,Math.floor(bytes.length/2));
   }
   return original.call(fs,fd,buffer,offset,length,position);
  });
  try{
   a.throws(()=>read(options),/INVALID_BUNDLE_FILE/);
   a.equal(mutated,true);
  }finally{mocked.mock.restore();fs.writeFileSync(path,bytes);}
 }
 a.deepEqual(read(options).bundle,options.bundle);
}));
test('oversized sparse bundle is rejected before any file read',t=>fixture(({options,path})=>{
 save(options);
 fs.truncateSync(path,80*1024*1024+1);
 const mock=t.mock.method(fs,'readSync',()=>a.fail('oversized file must not be read'));
 try{a.throws(()=>read(options),/INVALID_BUNDLE_FILE/);a.equal(mock.mock.callCount(),0);}
 finally{mock.mock.restore();}
}));
