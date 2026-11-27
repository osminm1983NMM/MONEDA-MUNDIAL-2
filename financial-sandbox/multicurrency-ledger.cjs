'use strict';
// Durable synthetic order projection. Separate from the live app and PostgreSQL.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync,fsyncSync,mkdtempSync,linkSync,rmSync,constants}=require('node:fs');
const {dirname,join}=require('node:path');
const {createHash}=require('node:crypto');
const {projectMulticurrency}=require('./multicurrency-projection.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const ordered=o=>JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]])));
const mode='synthetic-multicurrency-v1';
const orderKeys=['mode','id','principalUsdMinor','feeUsdMinor','payoutHnlMinor'];
function inspect(db){
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok')||db.prepare('PRAGMA foreign_key_check').get())fail('LEDGER_CORRUPT');
 const metadata=db.prepare('SELECT key,value FROM metadata LIMIT 2').all();
 if(metadata.length!==1||metadata[0].key!=='mode'||metadata[0].value!==mode)fail('INVALID_LEDGER');
 const orders=db.prepare('SELECT id,payload FROM orders ORDER BY id LIMIT 10001').all();
 const events=db.prepare('SELECT sequence,event_id,order_id,payload FROM events ORDER BY sequence LIMIT 50001').all();
 if(orders.length>10000||events.length>50000)fail('MANIFEST_LIMIT');
 const byOrder=new Map();
 for(const r of orders){
  const o=JSON.parse(r.payload);
  if(!o||o.id!==r.id||Object.keys(o).length!==orderKeys.length||!orderKeys.every(k=>Object.hasOwn(o,k))||ordered(o)!==r.payload)fail('LEDGER_CORRUPT');
  byOrder.set(r.id,{order:o,events:[]});
 }
 for(let i=0;i<events.length;i++){
  const r=events[i],e=JSON.parse(r.payload),entry=byOrder.get(r.order_id);
  if(r.sequence!==i+1||!entry||!e||e.eventId!==r.event_id||e.orderId!==r.order_id||ordered(e)!==r.payload)fail('LEDGER_CORRUPT');
  entry.events.push(e);
 }
 const stateCounts={};
 for(const {order,events} of byOrder.values()){
  const p=projectMulticurrency({environment:'sandbox',order,events});
  stateCounts[p.state]=(stateCounts[p.state]??0)+1;
 }
 return {format:'synthetic-multicurrency-manifest-v1',orders:orders.length,events:events.length,
  stateCounts:Object.fromEntries(Object.entries(stateCounts).sort(([a],[b])=>a<b?-1:a>b?1:0)),
  sha256:createHash('sha256').update(JSON.stringify([mode,orders,events])).digest('hex')};
}
function verifyMulticurrencyBackup({environment,path,expected}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(typeof path!=='string'||!path.endsWith('.sqlite')||!existsSync(path)||!lstatSync(path).isFile())fail('INVALID_BACKUP_PATH');
 if(expected?.format!=='synthetic-multicurrency-manifest-v1'||typeof expected.sha256!=='string'||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('INVALID_MANIFEST');
 const db=new DatabaseSync(path,{readOnly:true});
 try{
  db.exec('BEGIN');const actual=inspect(db);
  if(actual.sha256!==expected.sha256||actual.orders!==expected.orders||actual.events!==expected.events||JSON.stringify(actual.stateCounts)!==JSON.stringify(expected.stateCounts))fail('BACKUP_MISMATCH');
  db.exec('COMMIT');return actual;
 }finally{db.close();}
}
function openMulticurrencyLedger({environment,path,initialize=false}={}){
 if(environment!=='sandbox'||typeof path!=='string'||!path.endsWith('.sqlite')||typeof initialize!=='boolean')fail('SANDBOX_ONLY');
 if(initialize){const fd=openSync(path,'wx',0o600);closeSync(fd);}
 else if(!existsSync(path)||!lstatSync(path).isFile())fail('LEDGER_MISSING');
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  if(initialize)db.exec(`BEGIN IMMEDIATE;
   CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
   INSERT INTO metadata VALUES('mode','synthetic-multicurrency-v1');
   CREATE TABLE orders(id TEXT PRIMARY KEY, payload TEXT NOT NULL) STRICT;
   CREATE TABLE events(sequence INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL REFERENCES orders(id), payload TEXT NOT NULL) STRICT;
   CREATE INDEX events_order_sequence ON events(order_id,sequence);
   CREATE TRIGGER orders_no_update BEFORE UPDATE ON orders BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER orders_no_delete BEFORE DELETE ON orders BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER orders_no_replace BEFORE INSERT ON orders WHEN EXISTS(SELECT 1 FROM orders WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER events_no_replace BEFORE INSERT ON events WHEN EXISTS(SELECT 1 FROM events WHERE sequence=NEW.sequence OR event_id=NEW.event_id) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER metadata_no_replace BEFORE INSERT ON metadata WHEN EXISTS(SELECT 1 FROM metadata WHERE key=NEW.key) BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
   COMMIT;`);
  db.exec('BEGIN');inspect(db);db.exec('COMMIT');
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 }catch(e){db.close();throw e;}
 function tx(fn,write=true){
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
 }
 function load(orderId){
  if(!id(orderId))fail('INVALID_ORDER_ID');
  const row=db.prepare('SELECT payload FROM orders WHERE id=?').get(orderId);
  if(!row)fail('ORDER_NOT_FOUND');
  const order=JSON.parse(row.payload);
  if(order.id!==orderId)fail('LEDGER_CORRUPT');
  const events=db.prepare('SELECT event_id,payload FROM events WHERE order_id=? ORDER BY sequence').all(orderId).map(r=>{
   const e=JSON.parse(r.payload);
   if(e.eventId!==r.event_id||e.orderId!==orderId)fail('LEDGER_CORRUPT');
   return e;
  });
  return {order,events};
 }
 const project=(order,events)=>projectMulticurrency({environment,order,events});
 return {
  create(order){
   const keys=['mode','id','principalUsdMinor','feeUsdMinor','payoutHnlMinor'];
   if(!order||Object.keys(order).length!==keys.length||keys.some(k=>!Object.hasOwn(order,k)))fail('INVALID_ORDER');
   const projection=project(order,[]),payload=ordered(order);
   return tx(()=>{
    const prior=db.prepare('SELECT payload FROM orders WHERE id=?').get(order.id);
    if(prior){if(prior.payload!==payload)fail('ORDER_ID_CONFLICT');const x=load(order.id);return {status:'duplicate',projection:project(x.order,x.events)};}
    db.prepare('INSERT INTO orders VALUES(?,?)').run(order.id,payload);
    return {status:'created',projection};
   });
  },
  append(orderId,event){
   if(!event||!id(event.eventId)||event.orderId!==orderId)fail('INVALID_EVENT');
   return tx(()=>{
    const x=load(orderId);
    // Validate even a replay; the projection enforces exact event shape.
    const next=project(x.order,[...x.events,event]);
    const payload=ordered(event);
    const prior=db.prepare('SELECT order_id,payload FROM events WHERE event_id=?').get(event.eventId);
    if(prior){
     if(prior.order_id!==orderId||prior.payload!==payload)fail('EVENT_ID_CONFLICT');
     return {status:'duplicate',projection:project(x.order,x.events)};
    }
    db.prepare('INSERT INTO events(event_id,order_id,payload) VALUES(?,?,?)').run(event.eventId,orderId,payload);
    return {status:'applied',projection:next};
   });
  },
  get(orderId){return tx(()=>{const x=load(orderId);return project(x.order,x.events);},false);},
  counts(){return tx(()=>({orders:db.prepare('SELECT count(*) n FROM orders').get().n,events:db.prepare('SELECT count(*) n FROM events').get().n}),false);},
  manifest(){return tx(()=>inspect(db),false);},
  backup(destination){
   if(typeof destination!=='string'||!destination.endsWith('.sqlite'))fail('INVALID_BACKUP_PATH');
   const directory=dirname(destination);
   if(!lstatSync(directory).isDirectory())fail('INVALID_BACKUP_PATH');
   const expected=tx(()=>inspect(db),false);
   const staging=mkdtempSync(join(directory,'.mwd-multi-'));
   const candidate=join(staging,'candidate.sqlite');
   try{
    const fd=openSync(candidate,'wx',0o600);closeSync(fd);
    db.prepare('VACUUM INTO ?').run(candidate);
    const actual=verifyMulticurrencyBackup({environment,path:candidate,expected});
    const synced=openSync(candidate,'r');try{fsyncSync(synced);}finally{closeSync(synced);}
    linkSync(candidate,destination);
    return actual;
   }finally{
    rmSync(staging,{recursive:true,force:true});
    const dirfd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try{fsyncSync(dirfd);}finally{closeSync(dirfd);}
   }
  },
  close(){db.close();}
 };
}
module.exports={openMulticurrencyLedger,verifyMulticurrencyBackup};
