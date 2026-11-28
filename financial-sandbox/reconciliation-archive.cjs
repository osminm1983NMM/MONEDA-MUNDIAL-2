'use strict';
// Local synthetic archive only. No provider credentials, network, or live ledger.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,existsSync,lstatSync,fsyncSync,mkdtempSync,linkSync,rmSync,constants}=require('node:fs');
const {dirname,join}=require('node:path');
const {createHash}=require('node:crypto');
const {reconcilePagedCut}=require('./reconcile-paged-cut.cjs');
const {createReconciliationBundle,verifyReconciliationBundle}=require('./reconciliation-evidence-bundle.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function summarizeReceipt(result){
 const {internal,provider}=result.evidence;
 const id=digest(['synthetic-receipt-v1',internal.sha256,provider.sha256]);
 const counts=new Map();
 for(const i of result.issues)counts.set(i.code,(counts.get(i.code)||0)+1);
 return {mode:'sandbox',receiptId:id,evidence:result.evidence,clean:result.clean,
  issueCounts:Object.fromEntries([...counts].sort(([a],[b])=>a<b?-1:a>b?1:0)),
  matchedConfirmedNetMinor:result.clean?result.matchedConfirmedNetMinor:null};
}

// Digest the logical archive rather than its physical SQLite page layout.
// This is local consistency evidence, not authenticity against a privileged attacker.
// Require the exact immutability triggers defined by this archive format.
// A logically matching backup must not silently lose its write protections.
const requiredTriggers=[
 "CREATE TRIGGER snapshots_no_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER snapshots_no_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER receipts_no_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER receipts_no_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER snapshots_no_replace BEFORE INSERT ON snapshots WHEN EXISTS(SELECT 1 FROM snapshots WHERE source=NEW.source AND snapshot_id=NEW.snapshot_id) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER receipts_no_replace BEFORE INSERT ON receipts WHEN EXISTS(SELECT 1 FROM receipts WHERE receipt_id=NEW.receipt_id) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER metadata_no_replace BEFORE INSERT ON metadata WHEN EXISTS(SELECT 1 FROM metadata WHERE key=NEW.key) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END",
 "CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END"
];
function verifyTriggers(db){
 const actual=db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='trigger'").all();
 const normalize=sql=>typeof sql==='string'?sql.trim().replace(/;$/,'').replace(/\s+/g,' '):'';
 const byName=new Map(actual.map(x=>[x.name,normalize(x.sql)]));
 if(actual.length!==requiredTriggers.length||requiredTriggers.some(sql=>byName.get(sql.split(' ')[2])!==normalize(sql)))fail('ARCHIVE_CORRUPT');
}
function inspect(db){
 verifyTriggers(db);
 if(db.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='synthetic-reconciliation-archive-v1')fail('INVALID_ARCHIVE');
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok'))fail('ARCHIVE_CORRUPT');
 const snapshots=db.prepare('SELECT source,snapshot_id,fingerprint,evidence FROM snapshots ORDER BY source,snapshot_id').all();
 const receipts=db.prepare('SELECT receipt_id,summary FROM receipts ORDER BY receipt_id').all();
 const indexed=new Map(),used=new Set();
 for(const s of snapshots){
  const e=JSON.parse(s.evidence);
  if(e.source!==s.source||e.snapshotId!==s.snapshot_id||e.sha256!==s.fingerprint||!/^[a-f0-9]{64}$/.test(s.fingerprint))fail('ARCHIVE_CORRUPT');
  indexed.set(JSON.stringify([s.source,s.snapshot_id]),s);
 }
 for(const r of receipts){
  const x=JSON.parse(r.summary),e=x.evidence;
  if(x.mode!=='sandbox'||e?.format!=='synthetic-content-sha256-v1'||typeof x.clean!=='boolean'||x.receiptId!==r.receipt_id||digest(['synthetic-receipt-v1',e.internal?.sha256,e.provider?.sha256])!==r.receipt_id)fail('ARCHIVE_CORRUPT');
  for(const side of ['internal','provider']){
   const s=e[side],key=JSON.stringify([side,s?.snapshotId]),saved=indexed.get(key);
   if(!saved||s.source!==side||saved.evidence!==JSON.stringify(s))fail('ARCHIVE_CORRUPT');
   used.add(key);
  }
  if(!x.clean&&x.matchedConfirmedNetMinor!==null)fail('ARCHIVE_CORRUPT');
  if(x.clean&&(Object.keys(x.issueCounts).length!==0||!['USD','HNL'].every(k=>typeof x.matchedConfirmedNetMinor?.[k]==='string'&&/^-?\d+$/.test(x.matchedConfirmedNetMinor[k]))))fail('ARCHIVE_CORRUPT');
 }
 if(used.size!==snapshots.length)fail('ARCHIVE_CORRUPT');
 return {format:'synthetic-archive-manifest-v1',snapshots:snapshots.length,receipts:receipts.length,sha256:digest([snapshots,receipts])};
}
function verifyReconciliationBackup({environment,path,expected}={}){
 if(environment!=='sandbox'||typeof path!=='string'||!path.endsWith('.sqlite'))fail('SANDBOX_ONLY');
 if(!expected||expected.format!=='synthetic-archive-manifest-v1'||!Number.isSafeInteger(expected.snapshots)||expected.snapshots<0||!Number.isSafeInteger(expected.receipts)||expected.receipts<0||typeof expected.sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('INVALID_MANIFEST');
 if(!existsSync(path)||!lstatSync(path).isFile())fail('ARCHIVE_MISSING');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  db.exec('BEGIN');
  const actual=inspect(db);
  if(actual.sha256!==expected.sha256||actual.snapshots!==expected.snapshots||actual.receipts!==expected.receipts)fail('BACKUP_MISMATCH');
  db.exec('COMMIT');
  return actual;
 }finally{db.close();}
}

function openReconciliationArchive({environment,path,initialize=false}={}){
 if(environment!=='sandbox'||typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean')fail('SANDBOX_ONLY');
 if(initialize){const fd=openSync(path,'wx',0o600);closeSync(fd);}
 else if(!existsSync(path)||!lstatSync(path).isFile())fail('ARCHIVE_MISSING');
 const db=new DatabaseSync(path,{readOnly:false});
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  if(initialize)db.exec(`BEGIN IMMEDIATE;
   CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
   INSERT INTO metadata VALUES('mode','synthetic-reconciliation-archive-v1');
   CREATE TABLE snapshots(source TEXT NOT NULL CHECK(source IN ('internal','provider')),
     snapshot_id TEXT NOT NULL, fingerprint TEXT NOT NULL, evidence TEXT NOT NULL,
     PRIMARY KEY(source,snapshot_id)) STRICT;
   CREATE TABLE receipts(receipt_id TEXT PRIMARY KEY, summary TEXT NOT NULL) STRICT;
   CREATE TRIGGER snapshots_no_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER snapshots_no_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER receipts_no_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER receipts_no_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER snapshots_no_replace BEFORE INSERT ON snapshots WHEN EXISTS(SELECT 1 FROM snapshots WHERE source=NEW.source AND snapshot_id=NEW.snapshot_id) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER receipts_no_replace BEFORE INSERT ON receipts WHEN EXISTS(SELECT 1 FROM receipts WHERE receipt_id=NEW.receipt_id) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER metadata_no_replace BEFORE INSERT ON metadata WHEN EXISTS(SELECT 1 FROM metadata WHERE key=NEW.key) BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ARCHIVE'); END;
   COMMIT;`);
  if(db.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='synthetic-reconciliation-archive-v1')fail('INVALID_ARCHIVE');
  verifyTriggers(db);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 }catch(e){db.close();throw e;}
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
 const archive={
  record({internalPages,providerPages}={}){
   // Recompute from validated pages, never accept a caller-supplied clean flag or receipt.
   const result=reconcilePagedCut({environment,internalPages,providerPages});
   if(!result.evidence)return {status:'rejected',issues:result.issues};
   const {internal,provider}=result.evidence;
   const summary=summarizeReceipt(result),id=summary.receiptId;
   const encoded=JSON.stringify(summary);
   return tx(()=>{
    for(const s of [internal,provider]){
     const old=db.prepare('SELECT fingerprint,evidence FROM snapshots WHERE source=? AND snapshot_id=?').get(s.source,s.snapshotId);
     const evidence=JSON.stringify(s);
     if(old){if(old.fingerprint!==s.sha256||old.evidence!==evidence)fail('SNAPSHOT_ID_CONFLICT');}
     else db.prepare('INSERT INTO snapshots VALUES(?,?,?,?)').run(s.source,s.snapshotId,s.sha256,evidence);
    }
    const prior=db.prepare('SELECT summary FROM receipts WHERE receipt_id=?').get(id);
    if(prior){if(prior.summary!==encoded)fail('RECEIPT_CONFLICT');return {status:'duplicate',receipt:JSON.parse(prior.summary)};}
    db.prepare('INSERT INTO receipts VALUES(?,?)').run(id,encoded);
    return {status:'recorded',receipt:summary};
   });
  },
  get(id){if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))fail('INVALID_RECEIPT_ID');const row=db.prepare('SELECT summary FROM receipts WHERE receipt_id=?').get(id);return row?JSON.parse(row.summary):null;},
  // Opt-in normalized export: archive only the receipt; caller stores the
  // bundle separately. A failed validation or archive conflict returns no bundle.
  recordWithBundle({internalPages,providerPages}={}){
   const {bundle}=createReconciliationBundle({environment,internalPages,providerPages});
   const recorded=archive.record({internalPages:bundle.internalPages,providerPages:bundle.providerPages});
   if(recorded.status!=='recorded'&&recorded.status!=='duplicate')fail('INVALID_BUNDLE');
   return {...recorded,bundle};
  },
  // Read-only check anchored to an existing receipt, not to a supplied hash.
  verifyArchivedBundle(id,bundle){
   const receipt=archive.get(id);
   if(!receipt)fail('RECEIPT_NOT_FOUND');
   const result=verifyReconciliationBundle({environment,bundle,expectedEvidence:receipt.evidence});
   const recomputed=summarizeReceipt(result);
   if(JSON.stringify(recomputed)!==JSON.stringify(receipt))fail('RECEIPT_MISMATCH');
   return recomputed;
  },
  // Bounded, read-only inventory for offline recovery checks.
  listReceiptIds({limit=1000}={}){
   if(!Number.isSafeInteger(limit)||limit<1||limit>10000)fail('INVALID_INVENTORY_LIMIT');
   const rows=db.prepare('SELECT receipt_id FROM receipts ORDER BY receipt_id LIMIT ?').all(limit+1);
   if(rows.length>limit)fail('INVENTORY_LIMIT_EXCEEDED');
   if(rows.some(r=>!/^[a-f0-9]{64}$/.test(r.receipt_id)))fail('ARCHIVE_CORRUPT');
   return rows.map(r=>r.receipt_id);
  },
  counts(){return {snapshots:db.prepare('SELECT count(*) n FROM snapshots').get().n,receipts:db.prepare('SELECT count(*) n FROM receipts').get().n};},
  backup(destination){
   if(typeof destination!=='string'||!destination.endsWith('.sqlite'))fail('INVALID_BACKUP_PATH');
   // Compare with the source logical manifest before exclusive publication.
   // Writers must be paused; a changed source cut fails verification.
   const directory=dirname(destination);
   if(!lstatSync(directory).isDirectory())fail('INVALID_BACKUP_PATH');
   const expected=tx(()=>inspect(db));
   const staging=mkdtempSync(join(directory,'.mwd-archive-'));
   const candidate=join(staging,'candidate.sqlite');
   try{
    const fd=openSync(candidate,'wx',0o600);closeSync(fd);
    db.prepare('VACUUM INTO ?').run(candidate);
    const manifest=verifyReconciliationBackup({environment,path:candidate,expected});
    const synced=openSync(candidate,'r');
    try{fsyncSync(synced);}finally{closeSync(synced);}
    linkSync(candidate,destination);
    return manifest;
   }finally{
    // Never unlink the final destination, even after a directory sync failure.
    rmSync(staging,{recursive:true,force:true});
    const dirfd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try{fsyncSync(dirfd);}finally{closeSync(dirfd);}
   }
  },
  close(){db.close();}
 };
 return archive;
}
module.exports={openReconciliationArchive,verifyReconciliationBackup};
