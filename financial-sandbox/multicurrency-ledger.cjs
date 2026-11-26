'use strict';
// Durable synthetic order projection. Separate from the live app and PostgreSQL.
const {DatabaseSync}=require('node:sqlite');
const {openSync,closeSync,lstatSync,existsSync}=require('node:fs');
const {projectMulticurrency}=require('./multicurrency-projection.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const ordered=o=>JSON.stringify(Object.fromEntries(Object.keys(o).sort().map(k=>[k,o[k]])));
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
   COMMIT;`);
  if(db.prepare("SELECT value FROM metadata WHERE key='mode'").get()?.value!=='synthetic-multicurrency-v1')fail('INVALID_LEDGER');
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
  close(){db.close();}
 };
}
module.exports={openMulticurrencyLedger};
