'use strict';
// Local synthetic archive only. No provider credentials, network, or live ledger.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,existsSync,lstatSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {reconcilePagedCut}=require('./reconcile-paged-cut.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
   COMMIT;`);
  if(db.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='synthetic-reconciliation-archive-v1')fail('INVALID_ARCHIVE');
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 }catch(e){db.close();throw e;}
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {
  record({internalPages,providerPages}={}){
   // Recompute from validated pages, never accept a caller-supplied clean flag or receipt.
   const result=reconcilePagedCut({environment,internalPages,providerPages});
   if(!result.evidence)return {status:'rejected',issues:result.issues};
   const {internal,provider}=result.evidence;
   const id=digest(['synthetic-receipt-v1',internal.sha256,provider.sha256]);
   const counts=new Map();
   for(const i of result.issues)counts.set(i.code,(counts.get(i.code)||0)+1);
   const summary={mode:'sandbox',receiptId:id,evidence:result.evidence,clean:result.clean,
    issueCounts:Object.fromEntries([...counts].sort(([a],[b])=>a<b?-1:a>b?1:0)),
    // Partial matched totals are not authorization; withhold totals from non-clean receipts.
    matchedConfirmedNetMinor:result.clean?result.matchedConfirmedNetMinor:null};
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
  counts(){return {snapshots:db.prepare('SELECT count(*) n FROM snapshots').get().n,receipts:db.prepare('SELECT count(*) n FROM receipts').get().n};},
  close(){db.close();}
 };
}
module.exports={openReconciliationArchive};
