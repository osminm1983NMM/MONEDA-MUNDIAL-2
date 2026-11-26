'use strict';
const {normalizeVerifiedEvent}=require('./verified-event.cjs');
// Local synthetic prototype only. No network, actual funds, PII or live credentials.
const {DatabaseSync}=require('node:sqlite');
const {randomUUID,createHash}=require('node:crypto');
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const kinds=new Set(['funding','payout','refund']);
function validate(i){
 if(!i||i.mode!=='sandbox'||!id(i.reference)||!id(i.orderId)||!kinds.has(i.kind)||i.reference!==i.orderId+'-'+i.kind||
 i.currency!==(i.kind==='payout'?'HNL':'USD')||!Number.isSafeInteger(i.amountMinor)||i.amountMinor<=0)fail('INVALID_INTENT');
 return JSON.stringify([i.orderId,i.kind,i.currency,i.amountMinor]);
}
class DurableSandboxQueue{
 #db;#clock;
 constructor({environment,path,clock=Date.now}){
  if(environment!=='sandbox')fail('SANDBOX_ONLY');
  if(typeof path!=='string'||!path)fail('PATH_REQUIRED');
  this.#clock=clock;this.#db=new DatabaseSync(path);
  this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
  CREATE TABLE IF NOT EXISTS sandbox_outbox(
   reference TEXT PRIMARY KEY, payload TEXT NOT NULL, fingerprint TEXT NOT NULL,
   state TEXT NOT NULL CHECK(state IN ('queued','leased','acknowledged')),
   lease_token TEXT, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
   CHECK ((state='leased' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR
          (state!='leased' AND lease_token IS NULL AND lease_until IS NULL))
  ) STRICT;
  CREATE TABLE IF NOT EXISTS sandbox_inbox(
   provider TEXT NOT NULL, event_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
   raw TEXT NOT NULL, signature TEXT NOT NULL, received_at INTEGER NOT NULL,
   PRIMARY KEY(provider,event_id)
  ) STRICT;`);
 }
 #now(){const t=this.#clock();if(!Number.isSafeInteger(t)||t<0)fail('CLOCK');return t;}
 #tx(fn){this.#db.exec('BEGIN IMMEDIATE');try{const result=fn();this.#db.exec('COMMIT');return result;}catch(e){this.#db.exec('ROLLBACK');throw e;}}
 enqueue(intent){
  const payload=validate(intent),fp=hash(payload);
  return this.#tx(()=>{
   const old=this.#db.prepare('SELECT fingerprint,state FROM sandbox_outbox WHERE reference=?').get(intent.reference);
   if(old){if(old.fingerprint!==fp)fail('IDEMPOTENCY_CONFLICT');return {reference:intent.reference,state:old.state,duplicate:true};}
   this.#db.prepare("INSERT INTO sandbox_outbox(reference,payload,fingerprint,state) VALUES(?,?,?,'queued')").run(intent.reference,payload,fp);
   return {reference:intent.reference,state:'queued',duplicate:false};
  });
 }
 claim({leaseMs=30000}={}){
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1||leaseMs>300000)fail('INVALID_LEASE');
  return this.#tx(()=>{
   const now=this.#now(),until=now+leaseMs;if(!Number.isSafeInteger(until))fail('CLOCK');
   const row=this.#db.prepare("SELECT * FROM sandbox_outbox WHERE state='queued' OR (state='leased' AND lease_until<=?) ORDER BY rowid LIMIT 1").get(now);
   if(!row)return null;
   const token=randomUUID();
   this.#db.prepare("UPDATE sandbox_outbox SET state='leased',lease_token=?,lease_until=?,attempts=attempts+1 WHERE reference=?").run(token,until,row.reference);
   const [orderId,kind,currency,amountMinor]=JSON.parse(row.payload);
   return {intent:{reference:row.reference,orderId,kind,currency,amountMinor,mode:'sandbox'},token,leaseUntil:until,attempt:row.attempts+1};
  });
 }
 acknowledge(reference,token){
  if(!id(reference)||!id(token))fail('INVALID_LEASE');
  return this.#tx(()=>{
   // Evaluate expiry only after acquiring the write lock; waiting on another writer must not extend a lease.
   const result=this.#db.prepare("UPDATE sandbox_outbox SET state='acknowledged',lease_token=NULL,lease_until=NULL WHERE reference=? AND state='leased' AND lease_token=? AND lease_until>?").run(reference,token,this.#now());
   if(result.changes!==1)fail('STALE_LEASE');
   return {reference,state:'acknowledged'};
  });
 }
 // Verifier must be trusted and synchronous; only authenticated synthetic events enter inbox.
 ingest({raw,signature,provider}){
  if(provider?.mode!=='sandbox'||!id(provider.id)||typeof provider.verifyEvent!=='function'||typeof raw!=='string'||Buffer.byteLength(raw)>16384||typeof signature!=='string'||!/^[0-9a-f]{64}$/.test(signature))fail('INVALID_EVENT');
  const e=normalizeVerifiedEvent(provider.verifyEvent(raw,signature),provider.id);
  if(!e)fail('INVALID_EVENT');
  const fp=hash(raw);
  return this.#tx(()=>{
   const old=this.#db.prepare('SELECT fingerprint FROM sandbox_inbox WHERE provider=? AND event_id=?').get(e.provider,e.eventId);
   if(old){if(old.fingerprint!==fp)fail('EVENT_ID_CONFLICT');return {status:'duplicate'};}
   this.#db.prepare('INSERT INTO sandbox_inbox VALUES(?,?,?,?,?,?)').run(e.provider,e.eventId,fp,raw,signature,this.#now());
   return {status:'recorded_not_applied'};
  });
 }
 counts(){const outbox=this.#db.prepare('SELECT state,count(*) AS count FROM sandbox_outbox GROUP BY state').all();const inbox=this.#db.prepare('SELECT count(*) AS count FROM sandbox_inbox').get().count;return {outbox,inbox};}
 close(){this.#db.close();}
}
module.exports={DurableSandboxQueue};
