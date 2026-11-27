'use strict';
// Synthetic case records only. Never authorizes a payment, cancellation or
// refund; roles, clock and external evidence references are trusted fixtures.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync}=require('node:fs');
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
function openConsumerCaseLab({environment,path,initialize=false}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean')fail('INVALID_LAB_PATH');
 if(initialize){const fd=openSync(path,'wx',0o600);closeSync(fd);}
 else if(!existsSync(path)||!lstatSync(path).isFile())fail('LAB_MISSING');
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  if(initialize)db.exec("BEGIN IMMEDIATE; CREATE TABLE metadata(mode TEXT PRIMARY KEY CHECK(mode='consumer-case-fixture-v1')) STRICT; INSERT INTO metadata VALUES('consumer-case-fixture-v1'); CREATE TABLE events(sequence INTEGER PRIMARY KEY,event_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL) STRICT; CREATE TRIGGER meta_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER meta_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER event_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; CREATE TRIGGER event_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END; COMMIT;");
  if(db.prepare('SELECT mode FROM metadata').get()?.mode!=='consumer-case-fixture-v1')fail('INVALID_LAB');
 }catch(e){db.close();throw e;}
 const tx=(fn,write=true)=>{
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{const x=fn();db.exec('COMMIT');return x;}catch(e){db.exec('ROLLBACK');throw e;}
 };
 function history(){
  const rows=db.prepare('SELECT sequence,event_id,payload FROM events ORDER BY sequence LIMIT 10001').all();
  if(rows.length>10000)fail('INVALID_HISTORY');
  return rows.map((r,i)=>{
   const e=JSON.parse(r.payload);
   if(r.sequence!==i+1||e.eventId!==r.event_id||ordered(e)!==r.payload)fail('LAB_CORRUPT');
   return e;
  });
 }
 return {
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
  deadlineReview({plans,asOf,warningMs}={}){return tx(()=>require('./consumer-case-deadlines.cjs').reviewCaseDeadlines({environment,events:history(),plans,asOf,warningMs}),false);},
  audit(){return tx(()=>{const events=history();return {events,cases:projectConsumerCases(events)};},false);},
  close(){db.close();}
 };
}
module.exports={openConsumerCaseLab,projectConsumerCases};
