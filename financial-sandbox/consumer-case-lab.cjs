'use strict';
// Synthetic case records only. Never authorizes a payment, cancellation or
// refund; roles, clock and external evidence references are trusted fixtures.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync,unlinkSync,fsyncSync}=require('node:fs');
const {createHash}=require('node:crypto');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const time=v=>Number.isSafeInteger(v)&&v>=0;
const common=['eventId','caseId','kind','actor','role','at'];
const fields={
 received:['owner','orderRef','caseType','channel','locale','intakeRef'],
 investigating:[],
 determined:['outcome','decisionRef'],
 notice_recorded:['noticeRef'],
 remedy_observed:['remedyRef'],
 remedy_verified:['verificationRef'],
 closed:[]
};
const roles={received:'support',investigating:'investigator',determined:'investigator',notice_recorded:'support',remedy_observed:'operations',remedy_verified:'reconciliation',closed:'support'};
const ordered=e=>JSON.stringify(Object.fromEntries(Object.keys(e).sort().map(k=>[k,e[k]])));
function validate(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||!Object.hasOwn(fields,e.kind))fail('INVALID_EVENT');
 const keys=[...common,...fields[e.kind]];
 if(Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k))||
 ![e.eventId,e.caseId,e.actor].every(id)||!time(e.at))fail('INVALID_EVENT');
 if(e.role!==roles[e.kind])fail('ROLE_NOT_ALLOWED');
 if(e.kind==='received'){
  if(!id(e.owner)||!(e.orderRef===null||id(e.orderRef))||!id(e.intakeRef)||
  !['cancellation','error','information'].includes(e.caseType)||
  !['phone','written','app','agent'].includes(e.channel)||!['es','en'].includes(e.locale))fail('INVALID_INTAKE');
 }else if(e.kind==='determined'){
  if(!['remedy_required','no_remedy','uncertain'].includes(e.outcome)||!id(e.decisionRef))fail('INVALID_DECISION');
 }else if(fields[e.kind].some(k=>!id(e[k])))fail('INVALID_REFERENCE');
}
function projectConsumerCases(events){
 if(!Array.isArray(events)||events.length>10000)fail('INVALID_HISTORY');
 const cases=new Map(),seen=new Map();
 for(const e of events){
  validate(e);
  const fp=ordered(e);
  if(seen.has(e.eventId)){
   if(seen.get(e.eventId)!==fp)fail('EVENT_ID_CONFLICT');
   continue;
  }
  const c=cases.get(e.caseId);
  if(e.kind==='received'){
   if(c)fail('CASE_ID_CONFLICT');
   cases.set(e.caseId,{caseId:e.caseId,owner:e.owner,orderRef:e.orderRef,caseType:e.caseType,channel:e.channel,
    locale:e.locale,intakeRef:e.intakeRef,receivedAt:e.at,lastAt:e.at,state:'received',outcome:null,
    decisionActor:null,remedyActor:null,verificationActor:null});
  }else{
   if(!c)fail('CASE_NOT_FOUND');
   if(e.at<c.lastAt)fail('NONMONOTONIC_TIME');
   if(e.kind==='investigating'&&(c.state==='received'||c.state==='uncertain'))c.state='investigating';
   else if(e.kind==='determined'&&c.state==='investigating'){
    c.outcome=e.outcome;c.decisionActor=e.actor;c.decisionRef=e.decisionRef;
    c.state=e.outcome==='uncertain'?'uncertain':'notice_due';
   }else if(e.kind==='notice_recorded'&&c.state==='notice_due'){
    c.noticeRef=e.noticeRef;c.state=c.outcome==='remedy_required'?'remedy_pending':'ready_to_close';
   }else if(e.kind==='remedy_observed'&&c.state==='remedy_pending'){
    if(e.actor===c.decisionActor)fail('INDEPENDENT_REVIEW_REQUIRED');
    c.remedyActor=e.actor;c.remedyRef=e.remedyRef;c.state='verification_pending';
   }else if(e.kind==='remedy_verified'&&c.state==='verification_pending'){
    if(e.actor===c.remedyActor||e.actor===c.decisionActor)fail('INDEPENDENT_REVIEW_REQUIRED');
    c.verificationActor=e.actor;c.verificationRef=e.verificationRef;c.state='ready_to_close';
   }else if(e.kind==='closed'&&c.state==='ready_to_close')c.state='closed';
   else fail('INVALID_CASE_TRANSITION');
   c.lastAt=e.at;
  }
  seen.set(e.eventId,fp);
 }
 return [...cases.values()];
}
function readHistory(db){
  const rows=db.prepare('SELECT sequence,event_id,payload FROM events ORDER BY sequence LIMIT 10001').all();
  if(rows.length>10000)fail('INVALID_HISTORY');
  return rows.map((r,i)=>{
   const e=JSON.parse(r.payload);
   if(r.sequence!==i+1||e.eventId!==r.event_id||ordered(e)!==r.payload)fail('LAB_CORRUPT');
   return e;
  });
 }
function readPlans(db){
  const rows=db.prepare('SELECT sequence,case_id,stage,payload FROM deadline_plans ORDER BY sequence LIMIT 30001').all();
  if(rows.length>30000)fail('INVALID_PLANS');
  return rows.map((r,i)=>{
   const p=JSON.parse(r.payload);
   if(r.sequence!==i+1||p.caseId!==r.case_id||p.stage!==r.stage||ordered(p)!==r.payload)fail('LAB_CORRUPT');
   return p;
  });
 }

function inspectConsumerBackup(db){
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok'))fail('LAB_CORRUPT');
 const metadata=db.prepare('SELECT mode FROM metadata').all();
 if(metadata.length!==1||!['consumer-case-fixture-v1','consumer-case-fixture-v2'].includes(metadata[0].mode))fail('INVALID_LAB');
 const mode=metadata[0].mode,events=readHistory(db),cases=projectConsumerCases(events);
 const plans=mode==='consumer-case-fixture-v2'?readPlans(db):[];
 require('./consumer-case-deadlines.cjs').reviewCaseDeadlines({environment:'sandbox',events,plans,asOf:events.reduce((m,e)=>Math.max(m,e.at),0),warningMs:0});
 return {format:'consumer-case-manifest-v1',mode,events:events.length,plans:plans.length,cases:cases.length,
  sha256:createHash('sha256').update(JSON.stringify([mode,events.map(ordered),plans.map(ordered)])).digest('hex')};
}
function verifyConsumerCaseBackup({environment,path,expected}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||!existsSync(path)||!lstatSync(path).isFile())fail('INVALID_BACKUP_PATH');
 if(!expected||expected.format!=='consumer-case-manifest-v1'||typeof expected.sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('INVALID_MANIFEST');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  db.exec('BEGIN');const actual=inspectConsumerBackup(db);
  if(Object.keys(actual).length!==Object.keys(expected).length||Object.keys(actual).some(k=>actual[k]!==expected[k]))fail('BACKUP_MISMATCH');
  db.exec('COMMIT');return actual;
 }finally{db.close();}
}
function openConsumerCaseLab({environment,path,initialize=false,immutablePlans=false}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean'||typeof immutablePlans!=='boolean')fail('INVALID_LAB_PATH');
 if(initialize){const fd=openSync(path,'wx',0o600);closeSync(fd);}
 else if(!existsSync(path)||!lstatSync(path).isFile())fail('LAB_MISSING');
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA recursive_triggers=ON;');
  const mode=immutablePlans?'consumer-case-fixture-v2':'consumer-case-fixture-v1';
  if(initialize)db.exec(("BEGIN IMMEDIATE; CREATE TABLE metadata(mode TEXT PRIMARY KEY CHECK(mode='consumer-case-fixture-v1')) STRICT; INSERT INTO metadata VALUES('consumer-case-fixture-v1'); CREATE TABLE events(sequence INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL) STRICT; CREATE TRIGGER meta_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER meta_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER event_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER event_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER event_no_replace BEFORE INSERT ON events WHEN EXISTS(SELECT 1 FROM events WHERE sequence=NEW.sequence OR event_id=NEW.event_id) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;"+(immutablePlans?" CREATE TABLE deadline_plans(sequence INTEGER PRIMARY KEY,case_id TEXT NOT NULL,stage TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(case_id,stage)) STRICT; CREATE TRIGGER plan_no_update BEFORE UPDATE ON deadline_plans BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER plan_no_delete BEFORE DELETE ON deadline_plans BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER plan_no_replace BEFORE INSERT ON deadline_plans WHEN EXISTS(SELECT 1 FROM deadline_plans WHERE sequence=NEW.sequence OR (case_id=NEW.case_id AND stage=NEW.stage)) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;":"")+" COMMIT;").replaceAll('consumer-case-fixture-v1',mode));
  if(db.prepare('SELECT mode FROM metadata').get()?.mode!==mode)fail('INVALID_LAB');
 }catch(e){db.close();throw e;}
 const tx=(fn,write=true)=>{
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{const x=fn();db.exec('COMMIT');return x;}catch(e){db.exec('ROLLBACK');throw e;}
 };
 function history(){return readHistory(db);}
 function storedPlans(){if(!immutablePlans)fail('IMMUTABLE_PLANS_REQUIRED');return readPlans(db);}
 const review=(events,plans,asOf,warningMs)=>require('./consumer-case-deadlines.cjs').reviewCaseDeadlines({environment,events,plans,asOf,warningMs});
 return {
  recordDeadlinePlans(plans){
   if(!immutablePlans)fail('IMMUTABLE_PLANS_REQUIRED');
   if(!Array.isArray(plans)||plans.length<1||plans.length>100)fail('INVALID_BATCH');
   return tx(()=>{
    const events=history(),prior=storedPlans(),all=[...prior],added=[];
    const key=p=>JSON.stringify([p.caseId,p.stage]);
    const known=new Map(prior.map(p=>[key(p),ordered(p)]));
    // Validate before deduplication; malformed duplicate inputs never bypass checks.
    const asOf=events.reduce((m,e)=>Math.max(m,e.at),0);
    for(const p of plans){
     review(events,[p],asOf,0);
     const k=key(p),fp=ordered(p);
     if(known.has(k)){if(known.get(k)!==fp)fail('DEADLINE_PLAN_CONFLICT');continue;}
     known.set(k,fp);all.push(p);added.push(p);
    }
    review(events,all,asOf,0);
    const insert=db.prepare('INSERT INTO deadline_plans(case_id,stage,payload) VALUES(?,?,?)');
    for(const p of added)insert.run(p.caseId,p.stage,ordered(p));
    return {status:added.length?'applied':'duplicate',added:added.length};
   });
  },
  appendBatch(events){
   if(!Array.isArray(events)||events.length<1||events.length>100)fail('INVALID_BATCH');
   return tx(()=>{
    const prior=history(),all=[...prior],known=new Map(prior.map(e=>[e.eventId,ordered(e)])),added=[];
    for(const e of events){
     validate(e);const fp=ordered(e);
     if(known.has(e.eventId)){if(known.get(e.eventId)!==fp)fail('EVENT_ID_CONFLICT');continue;}
     known.set(e.eventId,fp);all.push(e);added.push(e);
    }
    projectConsumerCases(all);
    const insert=db.prepare('INSERT INTO events(event_id,payload) VALUES(?,?)');
    for(const e of added)insert.run(e.eventId,ordered(e));
    return {status:added.length?'applied':'duplicate',added:added.length};
   });
  },
  // Only an internal trusted test reader may supply this owner. This is
  // filtering, not authentication. No internal decision refs are returned.
  listForOwner(owner){
   if(!id(owner))fail('INVALID_OWNER');
   return tx(()=>projectConsumerCases(history()).filter(c=>c.owner===owner).map(c=>({
    caseId:c.caseId,caseType:c.caseType,receivedAt:c.receivedAt,lastAt:c.lastAt,state:c.state,locale:c.locale
   })),false);
  },
  deadlineReview({plans,asOf,warningMs}={}){
   if(immutablePlans&&plans!==undefined)fail('DEADLINE_OVERRIDE_FORBIDDEN');
   return tx(()=>review(history(),immutablePlans?storedPlans():plans,asOf,warningMs),false);
  },
  audit(){return tx(()=>{const events=history();return {events,cases:projectConsumerCases(events),...(immutablePlans?{deadlinePlans:storedPlans()}: {})};},false);},
  manifest(){return tx(()=>inspectConsumerBackup(db),false);},
  backup(destination){
   if(typeof destination!=='string'||!destination.endsWith('.sqlite'))fail('INVALID_BACKUP_PATH');
   const expected=tx(()=>inspectConsumerBackup(db),false);
   const fd=openSync(destination,'wx',0o600);closeSync(fd);
   try{
    db.prepare('VACUUM INTO ?').run(destination);
    const synced=openSync(destination,'r');try{fsyncSync(synced);}finally{closeSync(synced);}
    return verifyConsumerCaseBackup({environment,path:destination,expected});
   }catch(e){unlinkSync(destination);throw e;}
  },
  close(){db.close();}
 };
}
module.exports={openConsumerCaseLab,projectConsumerCases,verifyConsumerCaseBackup};
