'use strict';
const {isProviderEventId}=require('./verified-event.cjs');
// Independent synthetic provider database. Never use for real funds or production.
const {DatabaseSync}=require('node:sqlite');
const {createHmac,timingSafeEqual}=require('node:crypto');
const {openSync,closeSync,existsSync}=require('node:fs');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail=c=>{throw Object.assign(Error(c),{code:c});};
function normalize(i){
 if(!i||i.mode!=='sandbox'||!id(i.orderId)||!id(i.reference)||!['funding','payout','refund'].includes(i.kind)||i.reference!==i.orderId+'-'+i.kind||i.currency!==(i.kind==='payout'?'HNL':'USD')||!Number.isSafeInteger(i.amountMinor)||i.amountMinor<=0)fail('INVALID_INTENT');
 return {mode:'sandbox',orderId:i.orderId,reference:i.reference,kind:i.kind,currency:i.currency,amountMinor:i.amountMinor};
}
function openDurableProvider({environment,path,initialize=false,secret,clock=Date.now}){
 if(environment!=='sandbox'||typeof path!=='string'||path===':memory:'||!path.endsWith('.sqlite')||typeof secret!=='string'||secret.length<32)fail('SANDBOX_ONLY');
 if(initialize){const fd=openSync(path,'wx',0o600);closeSync(fd);}
 else if(!existsSync(path))fail('PROVIDER_STATE_MISSING');
 const db=new DatabaseSync(path,{readOnly:false});
 const sign=raw=>createHmac('sha256',secret).update(raw).digest('hex');
 try{
 db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 if(initialize)db.exec("BEGIN IMMEDIATE; CREATE TABLE metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT; CREATE TABLE submissions(reference TEXT PRIMARY KEY,payload TEXT NOT NULL) STRICT; CREATE TABLE events(event_id TEXT PRIMARY KEY,reference TEXT NOT NULL,raw TEXT NOT NULL) STRICT; INSERT INTO metadata VALUES('mode','sandbox-v1'); COMMIT;");
 if(db.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='sandbox-v1')fail('PROVIDER_STATE_INVALID');
 // A changed fixture key cannot silently authorize a different signing identity.
 if(initialize)db.prepare("INSERT INTO metadata VALUES('key_check',?)").run(sign('sandbox-provider-key-check-v1'));
 if(db.prepare("SELECT value FROM metadata WHERE key='key_check'").get()?.value!==sign('sandbox-provider-key-check-v1'))fail('PROVIDER_KEY_MISMATCH');
 // Existing submissions predate staging and retain their accepted status.
 if(!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='unconfirmed_payouts' AND type='table'").get()){
  db.exec('CREATE TABLE IF NOT EXISTS unconfirmed_payouts(reference TEXT PRIMARY KEY REFERENCES submissions(reference)) STRICT;');
 }
 }catch(e){db.close();throw e;}
 let lose=false;
 function tx(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}
 return {
 id:'mock-remittance',mode:'sandbox',
 async submit(input){
  const i=normalize(input),payload=JSON.stringify(i);
  const pending=tx(()=>{
   const old=db.prepare('SELECT payload FROM submissions WHERE reference=?').get(i.reference);
   if(old&&old.payload!==payload)fail('PROVIDER_IDEMPOTENCY_CONFLICT');
   if(!old){
    db.prepare('INSERT INTO submissions VALUES(?,?)').run(i.reference,payload);
    if(i.kind==='payout')db.prepare('INSERT INTO unconfirmed_payouts VALUES(?)').run(i.reference);
   }
   return Boolean(db.prepare('SELECT 1 FROM unconfirmed_payouts WHERE reference=?').get(i.reference));
  });
  if(lose){lose=false;fail('SIMULATED_RESPONSE_LOSS');}
  if(pending)return {accepted:false,reference:i.reference,status:'awaiting_confirmation'};
  return {accepted:true,reference:i.reference};
 },
 async confirmPayout(input){
  const i=normalize(input);
  if(i.kind!=='payout')fail('INVALID_INTENT');
  tx(()=>{
   const old=db.prepare('SELECT payload FROM submissions WHERE reference=?').get(i.reference);
   if(!old)fail('UNKNOWN_REFERENCE');
   if(old.payload!==JSON.stringify(i))fail('PROVIDER_IDEMPOTENCY_CONFLICT');
   db.prepare('DELETE FROM unconfirmed_payouts WHERE reference=?').run(i.reference);
  });
  if(lose){lose=false;fail('SIMULATED_RESPONSE_LOSS');}
  return {accepted:true,reference:i.reference};
 },
 async lookup(reference){
  if(!id(reference))fail('INVALID_REFERENCE');
  const row=db.prepare(
   'SELECT s.payload, p.reference IS NOT NULL AS pending FROM submissions s LEFT JOIN unconfirmed_payouts p USING(reference) WHERE s.reference=?'
  ).get(reference);
  if(!row)return {status:'absent'};
  return {status:row.pending?'awaiting_confirmation':'accepted',intent:normalize(JSON.parse(row.payload))};
 },
 loseNextResponse(){lose=true;},
 submissions(){return db.prepare('SELECT payload FROM submissions ORDER BY reference').all().map(r=>normalize(JSON.parse(r.payload)));},
 event(reference,type,eventId){
  if(!isProviderEventId(eventId))fail('INVALID_EVENT');
  return tx(()=>{
   const s=db.prepare('SELECT payload FROM submissions WHERE reference=?').get(reference);if(!s)fail('UNKNOWN_REFERENCE');
   if(db.prepare('SELECT 1 FROM unconfirmed_payouts WHERE reference=?').get(reference))fail('PAYOUT_NOT_CONFIRMED');
   const i=normalize(JSON.parse(s.payload));
   if(![i.kind+'_confirmed',i.kind+'_failed'].includes(type))fail('INVALID_EVENT');
   const prior=db.prepare('SELECT raw FROM events WHERE event_id=?').get(eventId);
   if(prior){const e=JSON.parse(prior.raw);if(e.reference!==reference||e.type!==type)fail('EVENT_ID_CONFLICT');return {raw:prior.raw,signature:sign(prior.raw)};}
   const timestamp=clock();if(!Number.isSafeInteger(timestamp)||timestamp<0)fail('CLOCK');
   const raw=JSON.stringify({mode:'sandbox',provider:'mock-remittance',eventId,orderId:i.orderId,reference,type,currency:i.currency,amountMinor:i.amountMinor,timestamp});
   db.prepare('INSERT INTO events VALUES(?,?,?)').run(eventId,reference,raw);
   return {raw,signature:sign(raw)};
  });
 },
 verifyEvent(raw,signature){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>16384||typeof signature!=='string'||!/^[0-9a-f]{64}$/.test(signature)||!timingSafeEqual(Buffer.from(sign(raw),'hex'),Buffer.from(signature,'hex')))fail('INVALID_SIGNATURE');
  const e=JSON.parse(raw);const now=clock();if(!Number.isSafeInteger(now)||now<0)throw Error('CLOCK');if(!Number.isSafeInteger(e?.timestamp)||e.timestamp<0||Math.abs(now-e.timestamp)>300000)fail('EVENT_EXPIRED');return e;
 },
 close(){db.close();}
 };
}
module.exports={openDurableProvider};
