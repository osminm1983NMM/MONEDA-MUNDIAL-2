'use strict';
// Private disposable SQLite laboratory; the two asset projections derive from
// one append-only conversion history. No production, network or live assets.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync,fsyncSync,mkdtempSync,linkSync,rmSync,constants}=require('node:fs');
const {dirname,join}=require('node:path');
const {createHash}=require('node:crypto');
const {projectDigitalCoinSwaps}=require('./digital-coin-swap-projection.cjs');
const {compareDigitalCoinCut}=require('./digital-coin-reconciliation.cjs');
const LEGACY='synthetic-digital-coin-v1',GATED='synthetic-digital-coin-gated-v1';
const {buildDigitalCoinQuote}=require('./digital-coin-pricing.cjs');
const AUDITED='synthetic-digital-coin-gated-v2',PRICED='synthetic-digital-coin-gated-v3';
const audited=mode=>mode===AUDITED||mode===PRICED;
const validMode=mode=>mode===LEGACY||mode===GATED||audited(mode);
const gated=mode=>mode===GATED||audited(mode);
const fail=code=>{throw Object.assign(Error(code),{code});};
const ordered=e=>JSON.stringify(Object.fromEntries(Object.keys(e).sort().map(k=>[k,e[k]])));
// Inspect a single read transaction. The manifest is independently retained
// evidence of the logical history, not protection against a privileged attacker.
function readHistory(db){
 const rows=db.prepare('SELECT sequence,event_id,payload FROM events ORDER BY sequence LIMIT 2001').all();
 if(rows.length>2000)fail('INVALID_HISTORY');
 return rows.map((r,i)=>{
  const e=JSON.parse(r.payload);
  if(r.sequence!==i+1||!e||e.eventId!==r.event_id||ordered(e)!==r.payload)fail('LEDGER_CORRUPT');
  return e;
 });
}
// Capture JSON-compatible evidence once, without invoking accessors or
// serialization hooks. Bound traversal to the laboratory's report sizes.
function snapshotEvidence(value){
 let nodes=0;
 function copy(v,depth){
  if(++nodes>100000||depth>12)fail('INVALID_RECONCILIATION_EVIDENCE');
  if(v===null||typeof v==='string'||typeof v==='boolean'||Number.isSafeInteger(v))return v;
  if(!v||typeof v!=='object')fail('INVALID_RECONCILIATION_EVIDENCE');
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(Array.isArray(v)){
   const n=descriptors.length.value;
   if(Object.getPrototypeOf(v)!==Array.prototype||n>10000||keys.length!==n+1)fail('INVALID_RECONCILIATION_EVIDENCE');
   return Array.from({length:n},(_,i)=>{
    const d=descriptors[String(i)];
    if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('INVALID_RECONCILIATION_EVIDENCE');
    return copy(d.value,depth+1);
   });
  }
  if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('INVALID_RECONCILIATION_EVIDENCE');
  return Object.fromEntries(keys.map(k=>{
   const d=descriptors[k];
   if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail('INVALID_RECONCILIATION_EVIDENCE');
   return [k,copy(d.value,depth+1)];
  }));
 }
 return copy(value,0);
}
function verifyPriceProofs(events,proofs){
 const quotes=events.filter(e=>e.kind==='quote_created');
 if(!Array.isArray(proofs)||proofs.length!==quotes.length)fail('PRICE_PROOF_REQUIRED');
 for(let i=0;i<quotes.length;i++){
  const proof=proofs[i],event=quotes[i];
  if(!proof||Object.keys(proof).length!==2||!Object.hasOwn(proof,'price')||!Object.hasOwn(proof,'request'))fail('INVALID_PRICE_PROOF');
  const computed=buildDigitalCoinQuote({environment:'sandbox',price:proof.price,request:proof.request,now:event.at});
  if(ordered(computed.quoteEvent)!==ordered(event))fail('PRICE_QUOTE_MISMATCH');
 }
}
function manifestFor(row,events,projection,receipts=[]){
 const contents=[row.mode,row.seed,events.map(ordered)];
 if(audited(row.mode))contents.push(receipts);
 const sha256=createHash('sha256').update(JSON.stringify(contents)).digest('hex');
 return {format:'synthetic-digital-coin-manifest-v1',events:events.length,sha256,
  reserveUsdMinor:projection.digital.reserveUsdMinor,obligationsUsdMinor:projection.digital.obligationsUsdMinor,
  coinOutstandingMinor:projection.coin.outstandingMinor};
}
function verifyReceipts(db,row,base,events){
 if(!audited(row.mode))return [];
 const rows=db.prepare('SELECT start_sequence,end_sequence,evidence FROM reconciliation_receipts ORDER BY start_sequence LIMIT 2001').all();
 if(rows.length>2000)fail('INVALID_RECEIPT_HISTORY');
 const prefix=[];let count=0;
 for(const receipt of rows){
  if(receipt.start_sequence!==count+1||receipt.end_sequence<receipt.start_sequence||receipt.end_sequence>events.length||
   receipt.end_sequence-receipt.start_sequence>=100)fail('RECEIPT_COVERAGE_MISMATCH');
  const proof=JSON.parse(receipt.evidence),prior=events.slice(0,count);
  const projection=projectDigitalCoinSwaps({environment:'sandbox',...base,events:prior});
  const manifest=manifestFor(row,prior,projection,prefix);
  if(proof.internalSha256!==manifest.sha256)fail('RECEIPT_HISTORY_MISMATCH');
  const result=compareDigitalCoinCut({environment:'sandbox',cutId:proof.cutId,snapshot:{manifest,projection},reports:proof.reports});
  if(!result.clean)fail('RECEIPT_DISCREPANCY');
  if(row.mode===PRICED)verifyPriceProofs(events.slice(count,receipt.end_sequence),proof.priceProofs);
  prefix.push(receipt);count=receipt.end_sequence;
 }
 if(count!==events.length)fail('RECEIPT_COVERAGE_MISMATCH');
 return prefix;
}
function inspect(db){
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok'))fail('LEDGER_CORRUPT');
 const row=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
 if(!validMode(row?.mode))fail('INVALID_LEDGER');
 const base=JSON.parse(row.seed);
 if(!base||Object.keys(base).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(base,k)))fail('INVALID_SEED');
 const events=readHistory(db);
 const projection=projectDigitalCoinSwaps({environment:'sandbox',...base,events});
 const receipts=verifyReceipts(db,row,base,events);
 return manifestFor(row,events,projection,receipts);
}
function verifyDigitalCoinBackup({environment,path,expected}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||!existsSync(path)||!lstatSync(path).isFile())fail('INVALID_BACKUP_PATH');
 if(!expected||expected.format!=='synthetic-digital-coin-manifest-v1'||!Number.isSafeInteger(expected.events)||
 expected.events<0||expected.events>2000||typeof expected.sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('INVALID_MANIFEST');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  db.exec('BEGIN');const actual=inspect(db);
  if(Object.keys(actual).some(k=>actual[k]!==expected[k]))fail('BACKUP_MISMATCH');
  db.exec('COMMIT');return actual;
 }finally{db.close();}
}
function openDigitalCoinLedger({environment,path,initialize=false,seed,requireReconciliation,requireVerifiedPricing}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean')fail('INVALID_LEDGER_PATH');
 if(requireReconciliation!==undefined&&(typeof requireReconciliation!=='boolean'||!initialize))fail('INVALID_GATE_CONFIGURATION');
 if(requireVerifiedPricing!==undefined&&(typeof requireVerifiedPricing!=='boolean'||!initialize||requireVerifiedPricing&&!requireReconciliation))fail('INVALID_PRICING_CONFIGURATION');
 if(initialize){
  if(!seed||Object.keys(seed).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(seed,k)))fail('INVALID_SEED');
  projectDigitalCoinSwaps({environment,...seed,events:[]});
  const fd=openSync(path,'wx',0o600);closeSync(fd);
 }else{
  if(seed!==undefined)fail('SEED_IMMUTABLE');
  if(!existsSync(path)||!lstatSync(path).isFile())fail('LEDGER_MISSING');
 }
 const db=new DatabaseSync(path);
 let base,mode,seedBytes;
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA recursive_triggers=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  if(initialize){
   db.exec('BEGIN IMMEDIATE;');
   try{
    db.exec("CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL,seed TEXT NOT NULL) STRICT; CREATE TABLE events(sequence INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL) STRICT;");
    db.prepare('INSERT INTO metadata VALUES(1,?,?)').run(requireVerifiedPricing===true?PRICED:requireReconciliation===true?AUDITED:LEGACY,JSON.stringify(seed));
    if(requireReconciliation===true)db.exec("CREATE TABLE reconciliation_receipts(start_sequence INTEGER PRIMARY KEY,end_sequence INTEGER NOT NULL,evidence TEXT NOT NULL) STRICT; CREATE TRIGGER receipts_no_update BEFORE UPDATE ON reconciliation_receipts BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER receipts_no_delete BEFORE DELETE ON reconciliation_receipts BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER receipts_no_replace BEFORE INSERT ON reconciliation_receipts WHEN EXISTS(SELECT 1 FROM reconciliation_receipts WHERE start_sequence=NEW.start_sequence) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;");
    db.exec("CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER metadata_no_replace BEFORE INSERT ON metadata WHEN EXISTS(SELECT 1 FROM metadata WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER events_no_replace BEFORE INSERT ON events WHEN EXISTS(SELECT 1 FROM events WHERE sequence=NEW.sequence OR event_id=NEW.event_id) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; COMMIT;");
   }catch(e){db.exec('ROLLBACK');throw e;}
  }
  db.exec('BEGIN');
  const row=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
  if(!validMode(row?.mode))fail('INVALID_LEDGER');
  mode=row.mode;
  seedBytes=row.seed;
  base=JSON.parse(seedBytes);
  if(!base||Object.keys(base).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(base,k)))fail('INVALID_SEED');
  // Validate the complete committed history and all required receipts before
  // exposing a recovered ledger. Closing on error rolls back the read transaction.
  inspect(db);
  db.exec('COMMIT');
 }catch(e){db.close();throw e;}
 const project=events=>projectDigitalCoinSwaps({environment,...base,events});
 // An already-open handle must not combine a changed durable seed/mode
 // with its cached projection. This detects drift, not privileged tamper proofing.
 function assertMetadata(){
  const row=db.prepare('SELECT id,mode,seed FROM metadata ORDER BY id LIMIT 2').all();
  if(row.length!==1||row[0].id!==1||row[0].mode!==mode||row[0].seed!==seedBytes)fail('LEDGER_METADATA_CHANGED');
 }
 function tx(fn,write=true){
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{assertMetadata();const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
 }
 function history(){return readHistory(db);}
 return {
  appendBatch(events,evidence){
   if(!Array.isArray(events)||events.length<1||events.length>100)fail('INVALID_BATCH');
   return tx(()=>{
    const prior=history(),all=[...prior],known=new Map(prior.map(e=>[e.eventId,ordered(e)])),added=[];
    // Reject invalid shape even for duplicate submissions. Deduplicate only
    // identical payloads; never let a replay consume another journal sequence.
    for(const e of events){
     // Capture a single plain data record. Never invoke field getters or
     // serialize one object while projecting a different mutable value.
     if(!e||typeof e!=='object'||Array.isArray(e)||
      ![Object.prototype,null].includes(Object.getPrototypeOf(e)))fail('INVALID_SWAP_EVENT');
     const descriptors=Object.getOwnPropertyDescriptors(e),keys=Reflect.ownKeys(descriptors);
     if(keys.some(k=>typeof k!=='string'||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')||
      !(typeof descriptors[k].value==='string'||typeof descriptors[k].value==='number'&&Number.isSafeInteger(descriptors[k].value))))fail('INVALID_SWAP_EVENT');
     const normalized=Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
     if(typeof normalized.eventId!=='string')fail('INVALID_SWAP_EVENT');
     const payload=ordered(normalized);
     if(known.has(normalized.eventId)){
      if(known.get(normalized.eventId)!==payload)fail('EVENT_ID_CONFLICT');
      continue;
     }
     known.set(normalized.eventId,payload);all.push(normalized);added.push([normalized.eventId,payload]);
    }
    const projection=project(all);
    // The mode is durable and cannot be disabled on reopen. Exact replays
    // have no new financial effect. New events require a fresh matching cut.
    let receiptEvidence;
    // An idempotent replay must not report success over damaged receipt history.
    if(audited(mode)&&!added.length)inspect(db);
    if(gated(mode)&&added.length){
     if(!evidence)fail('RECONCILIATION_REQUIRED');
     const proof=snapshotEvidence(evidence);
     if(typeof proof.internalSha256!=='string')fail('RECONCILIATION_REQUIRED');
     const manifest=inspect(db);
     if(proof.internalSha256!==manifest.sha256)fail('STALE_RECONCILIATION');
     const result=compareDigitalCoinCut({environment,cutId:proof.cutId,
      snapshot:{manifest,projection:project(prior)},reports:proof.reports});
     if(!result.clean)fail('RECONCILIATION_DISCREPANCY');
     if(mode===PRICED)verifyPriceProofs(all.slice(prior.length),proof.priceProofs??[]);
     if(audited(mode))receiptEvidence=JSON.stringify({cutId:proof.cutId,internalSha256:proof.internalSha256,reports:proof.reports,
      ...(mode===PRICED?{priceProofs:proof.priceProofs??[]}: {})});
    }
    const insert=db.prepare('INSERT INTO events(event_id,payload) VALUES(?,?)');
    for(const row of added)insert.run(...row);
    if(receiptEvidence!==undefined)db.prepare('INSERT INTO reconciliation_receipts VALUES(?,?,?)').run(prior.length+1,all.length,receiptEvidence);
    return {status:added.length?'applied':'duplicate',added:added.length,projection};
   });
  },
  reconciliationRequired(){return gated(mode);},
  verifiedPricingRequired(){return mode===PRICED;},
  auditReconciliation(){return tx(()=>{
   if(!audited(mode))fail('AUDITED_MODE_REQUIRED');
   const manifest=inspect(db);
   const receipts=db.prepare('SELECT start_sequence,end_sequence FROM reconciliation_receipts ORDER BY start_sequence').all();
   return {manifest,receipts:receipts.map(r=>({startSequence:r.start_sequence,endSequence:r.end_sequence}))};
  },false);},
  get(){return tx(()=>{if(audited(mode))inspect(db);return project(history());},false);},
  counts(){return tx(()=>({events:history().length}),false);},
  manifest(){return tx(()=>inspect(db),false);},
  reconciliationSnapshot(){return tx(()=>({manifest:inspect(db),projection:project(history())}),false);},
  // Local POSIX laboratory, trusted private directory, writers paused.
  // Never expose an incomplete backup at its final name. A process crash
  // before publication may leave a private staging directory for inspection.
  backup(destination){
   if(typeof destination!=='string'||!destination.endsWith('.sqlite'))fail('INVALID_BACKUP_PATH');
   const directory=dirname(destination);
   if(!lstatSync(directory).isDirectory())fail('INVALID_BACKUP_PATH');
   const expected=tx(()=>inspect(db),false);
   const staging=mkdtempSync(join(directory,'.mwd-backup-'));
   const candidate=join(staging,'candidate.sqlite');
   try{
    const fd=openSync(candidate,'wx',0o600);closeSync(fd);
    db.prepare('VACUUM INTO ?').run(candidate);
    const verified=verifyDigitalCoinBackup({environment,path:candidate,expected});
    const synced=openSync(candidate,'r');try{fsyncSync(synced);}finally{closeSync(synced);}
    // Atomic, exclusive publication on the same filesystem; no replacement.
    linkSync(candidate,destination);
    return verified;
   }finally{
    // Never remove the published destination, even if directory sync fails.
    rmSync(staging,{recursive:true,force:true});
    const dirfd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try{fsyncSync(dirfd);}finally{closeSync(dirfd);}
   }
  },
  close(){db.close();}
 };
}
// Serve a previously audited immutable LAB backup using an OS read-only handle.
// Expected manifest must be retained separately by the trusted operator.
function openDigitalCoinWalletSnapshot({environment,path,expected}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!expected||expected.format!=='synthetic-digital-coin-manifest-v1'||!Number.isSafeInteger(expected.events)||expected.events<0||expected.events>2000||typeof expected.sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('INVALID_MANIFEST');
 const pinned=Object.freeze({...expected});
 if(typeof path!=='string'||!path.endsWith('.sqlite')||!existsSync(path)||!lstatSync(path).isFile())fail('INVALID_BACKUP_PATH');
 const db=new DatabaseSync(path,{readOnly:true});
 let closed=false;
 function snapshot(){
  if(closed)fail('LEDGER_CLOSED');
  db.exec('BEGIN');
  try{
   const row=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
   if(row?.mode!==PRICED)fail('VERIFIED_PRICING_REQUIRED');
   const manifest=inspect(db);
   if(Object.keys(manifest).some(k=>manifest[k]!==pinned[k]))fail('BACKUP_MISMATCH');
   const projection=projectDigitalCoinSwaps({environment,...JSON.parse(row.seed),events:readHistory(db)});
   db.exec('COMMIT');return {manifest,projection};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 try{db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=1000;');snapshot();}
 catch(e){db.close();throw e;}
 return Object.freeze({reconciliationRequired:()=>true,verifiedPricingRequired:()=>true,reconciliationSnapshot:snapshot,
  close(){if(!closed){closed=true;db.close();}}});
}
module.exports={openDigitalCoinLedger,verifyDigitalCoinBackup,openDigitalCoinWalletSnapshot};
