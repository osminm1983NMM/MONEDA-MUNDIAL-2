'use strict';
// Private disposable SQLite laboratory; the two asset projections derive from
// one append-only conversion history. No production, network or live assets.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync,unlinkSync,fsyncSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {projectDigitalCoinSwaps}=require('./digital-coin-swap-projection.cjs');
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
function inspect(db){
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok'))fail('LEDGER_CORRUPT');
 const row=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
 if(row?.mode!=='synthetic-digital-coin-v1')fail('INVALID_LEDGER');
 const base=JSON.parse(row.seed);
 if(!base||Object.keys(base).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(base,k)))fail('INVALID_SEED');
 const events=readHistory(db);
 const projection=projectDigitalCoinSwaps({environment:'sandbox',...base,events});
 const sha256=createHash('sha256').update(JSON.stringify([row.mode,row.seed,events.map(ordered)])).digest('hex');
 return {format:'synthetic-digital-coin-manifest-v1',events:events.length,sha256,
  reserveUsdMinor:projection.digital.reserveUsdMinor,obligationsUsdMinor:projection.digital.obligationsUsdMinor,
  coinOutstandingMinor:projection.coin.outstandingMinor};
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
function openDigitalCoinLedger({environment,path,initialize=false,seed}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean')fail('INVALID_LEDGER_PATH');
 if(initialize){
  if(!seed||Object.keys(seed).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(seed,k)))fail('INVALID_SEED');
  projectDigitalCoinSwaps({environment,...seed,events:[]});
  const fd=openSync(path,'wx',0o600);closeSync(fd);
 }else{
  if(seed!==undefined)fail('SEED_IMMUTABLE');
  if(!existsSync(path)||!lstatSync(path).isFile())fail('LEDGER_MISSING');
 }
 const db=new DatabaseSync(path);
 let base;
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  if(initialize){
   db.exec('BEGIN IMMEDIATE;');
   try{
    db.exec("CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1),mode TEXT NOT NULL,seed TEXT NOT NULL) STRICT; CREATE TABLE events(sequence INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL) STRICT;");
    db.prepare('INSERT INTO metadata VALUES(1,?,?)').run('synthetic-digital-coin-v1',JSON.stringify(seed));
    db.exec("CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; COMMIT;");
   }catch(e){db.exec('ROLLBACK');throw e;}
  }
  const row=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
  if(row?.mode!=='synthetic-digital-coin-v1')fail('INVALID_LEDGER');
  base=JSON.parse(row.seed);
  if(!base||Object.keys(base).length!==3||!['capMinor','digitalEvents','coinEvents'].every(k=>Object.hasOwn(base,k)))fail('INVALID_SEED');
  projectDigitalCoinSwaps({environment,...base,events:[]});
 }catch(e){db.close();throw e;}
 const project=events=>projectDigitalCoinSwaps({environment,...base,events});
 function tx(fn,write=true){
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
 }
 function history(){return readHistory(db);}
 return {
  appendBatch(events){
   if(!Array.isArray(events)||events.length<1||events.length>100)fail('INVALID_BATCH');
   return tx(()=>{
    const prior=history(),all=[...prior],known=new Map(prior.map(e=>[e.eventId,ordered(e)])),added=[];
    // Reject invalid shape even for duplicate submissions. Deduplicate only
    // identical payloads; never let a replay consume another journal sequence.
    for(const e of events){
     if(!e||typeof e!=='object'||Array.isArray(e)||typeof e.eventId!=='string')fail('INVALID_SWAP_EVENT');
     const payload=ordered(e);
     if(known.has(e.eventId)){
      if(known.get(e.eventId)!==payload)fail('EVENT_ID_CONFLICT');
      // A JSON payload cannot represent undefined or extra non-JSON fields.
      const normalized=JSON.parse(payload);
      if(Object.keys(e).length!==Object.keys(normalized).length||Object.keys(e).some(k=>e[k]!==normalized[k]))fail('INVALID_SWAP_EVENT');
      continue;
     }
     known.set(e.eventId,payload);all.push(e);added.push([e.eventId,payload]);
    }
    const projection=project(all);
    const insert=db.prepare('INSERT INTO events(event_id,payload) VALUES(?,?)');
    for(const row of added)insert.run(...row);
    return {status:added.length?'applied':'duplicate',added:added.length,projection};
   });
  },
  get(){return tx(()=>project(history()),false);},
  counts(){return tx(()=>({events:history().length}),false);},
  manifest(){return tx(()=>inspect(db),false);},
  reconciliationSnapshot(){return tx(()=>({manifest:inspect(db),projection:project(history())}),false);},
  // Writers should be paused. If a write races the snapshot and changes its
  // contents, independent manifest verification fails and removes the copy.
  backup(destination){
   if(typeof destination!=='string'||!destination.endsWith('.sqlite'))fail('INVALID_BACKUP_PATH');
   const expected=tx(()=>inspect(db),false);
   const fd=openSync(destination,'wx',0o600);closeSync(fd);
   try{
    db.prepare('VACUUM INTO ?').run(destination);
    const synced=openSync(destination,'r');try{fsyncSync(synced);}finally{closeSync(synced);}
    return verifyDigitalCoinBackup({environment,path:destination,expected});
   }catch(e){unlinkSync(destination);throw e;}
  },
  close(){db.close();}
 };
}
module.exports={openDigitalCoinLedger,verifyDigitalCoinBackup};
