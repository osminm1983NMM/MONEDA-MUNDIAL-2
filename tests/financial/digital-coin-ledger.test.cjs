'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const fs=require('node:fs');const {join}=require('node:path');const {tmpdir}=require('node:os');
const {openDigitalCoinLedger:open}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const quote=(q='q',at=10,digitalMinor='200',coinMinor='300')=>({eventId:q+'-q',kind:'quote_created',at,quoteId:q,owner:'alice',direction:'digital_to_coin',digitalMinor,coinMinor,expiresAt:at+100});
const accept=(q='q',at=11)=>({eventId:q+'-a',kind:'quote_accepted',at,quoteId:q,owner:'alice'});
const end=(q='q',at=12,kind='swap_confirmed')=>({eventId:q+'-end',kind,at,quoteId:q});
function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-swap-')),options={environment:'sandbox',path:join(dir,'ledger.sqlite')};
 let ledger=open({...options,initialize:true,seed});
 try{fn({options,get ledger(){return ledger;},reopen(){ledger.close();ledger=open(options);return ledger;}});}
 finally{ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('reservation survives reopen, then both assets settle once and replay survives another restart',()=>fixture(f=>{
 const held=f.ledger.appendBatch([quote(),accept()]);
 a.equal(held.projection.digital.accounts[0].reserved,'200');
 a.equal(held.projection.coin.accounts[0].reserved,'300');
 a.deepEqual(f.reopen().get(),held.projection);
 const paid=f.ledger.appendBatch([end()]);
 a.equal(paid.projection.digital.accounts[0].available,'800');
 a.equal(paid.projection.coin.accounts.find(x=>x.owner==='alice').available,'300');
 a.deepEqual(f.reopen().get(),paid.projection);
 const replay=f.ledger.appendBatch([quote(),accept(),end()]);
 a.equal(replay.status,'duplicate');a.equal(replay.added,0);a.deepEqual(f.ledger.counts(),{events:3});
}));
test('invalid second leg rolls back whole batch with no partial records',()=>fixture(f=>{
 const before=f.ledger.get();
 a.throws(()=>f.ledger.appendBatch([quote('q',10,'200','1001'),accept(),end()]),/INSUFFICIENT_AVAILABLE/);
 a.deepEqual(f.ledger.counts(),{events:0});a.deepEqual(f.reopen().get(),before);
 a.equal(f.ledger.appendBatch([quote(),accept(),end()]).status,'applied');
}));
test('separate connections see latest committed reservations and reject overcommit',()=>fixture(f=>{
 const other=open(f.options);
 try{
  f.ledger.appendBatch([quote('q',10,'700','300'),accept()]);
  a.throws(()=>other.appendBatch([quote('r',20,'400','300'),accept('r',21)]),/INSUFFICIENT_AVAILABLE/);
  a.deepEqual(other.counts(),{events:2});
  other.appendBatch([end('q',22,'swap_cancelled')]);
  a.equal(f.ledger.get().digital.accounts[0].available,'1000');
  f.ledger.appendBatch([quote('r',30,'400','300'),accept('r',31)]);
  a.equal(other.get().digital.accounts[0].reserved,'400');
 }finally{other.close();}
}));
test('conflicting IDs, unknown transitions and noncanonical duplicate fields cannot write',()=>fixture(f=>{
 f.ledger.appendBatch([quote(),accept()]);
 a.throws(()=>f.ledger.appendBatch([{...quote(),digitalMinor:'201'}]),/EVENT_ID_CONFLICT/);
 a.throws(()=>f.ledger.appendBatch([{...quote(),extra:undefined}]),/INVALID_SWAP_EVENT/);
 a.throws(()=>f.ledger.appendBatch([end('other')]),/QUOTE_NOT_FOUND/);
 a.deepEqual(f.ledger.counts(),{events:2});
}));
test('immutable seed, exclusive file, append-only ordinary SQL and sandbox guard',()=>fixture(f=>{
 a.throws(()=>open({...f.options,seed}),/SEED_IMMUTABLE/);
 a.throws(()=>open({...f.options,initialize:true,seed}),/EEXIST/);
 a.throws(()=>open({...f.options,environment:'production'}),/SANDBOX_ONLY/);
 f.ledger.appendBatch([quote()]);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.path);
 try{
  a.throws(()=>db.exec("UPDATE events SET payload='{}'"),/APPEND_ONLY/);
  a.throws(()=>db.exec('DELETE FROM metadata'),/APPEND_ONLY/);
 }finally{db.close();}
 a.equal(f.reopen().get().quotes[0].state,'quoted');
}));


test('new ledgers reject SQL replacement of metadata or events even with recursive triggers off',()=>fixture(f=>{
 f.ledger.appendBatch([quote()]);const expected=f.ledger.manifest();
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.path);
 try{
  db.exec('PRAGMA recursive_triggers=OFF');
  a.throws(()=>db.exec("INSERT OR REPLACE INTO metadata SELECT id,mode,seed FROM metadata"),/APPEND_ONLY/);
  a.throws(()=>db.exec("INSERT OR REPLACE INTO events SELECT sequence,event_id,payload FROM events"),/APPEND_ONLY/);
  a.throws(()=>db.exec("INSERT OR REPLACE INTO events SELECT sequence+1,event_id,payload FROM events"),/APPEND_ONLY/);
  a.throws(()=>db.exec("INSERT OR REPLACE INTO events SELECT sequence,'other',payload FROM events"),/APPEND_ONLY/);
 }finally{db.close();}
 a.deepEqual(f.reopen().manifest(),expected);
 a.equal(f.ledger.appendBatch([accept()]).status,'applied');
}));

test('open handles reject durable seed or gate-mode drift before reads or writes',()=>fixture(f=>{
 const second=open(f.options);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.path);
 const original=db.prepare('SELECT mode,seed FROM metadata WHERE id=1').get();
 try{
  f.ledger.appendBatch([quote()]);
  // Privileged fault injection deliberately removes a protection trigger.
  db.exec('DROP TRIGGER metadata_no_update');
  for(const [mode,seedValue] of [[original.mode,JSON.stringify({...seed,capMinor:'2000'})],['synthetic-digital-coin-gated-v1',original.seed]]){
   db.prepare('UPDATE metadata SET mode=?,seed=? WHERE id=1').run(mode,seedValue);
   for(const handle of [f.ledger,second]){
    for(const action of [()=>handle.get(),()=>handle.counts(),()=>handle.manifest(),()=>handle.reconciliationSnapshot(),()=>handle.appendBatch([accept()]),()=>handle.appendBatch([quote()])])
     a.throws(action,/LEDGER_METADATA_CHANGED/);
   }
   a.equal(db.prepare('SELECT count(*) AS n FROM events').get().n,1);
   db.prepare('UPDATE metadata SET mode=?,seed=? WHERE id=1').run(original.mode,original.seed);
  }
  a.equal(second.appendBatch([accept()]).status,'applied');
  a.equal(f.ledger.get().quotes[0].state,'reserved');
 }finally{db.close();second.close();}
}));

test('accessor and hidden event fields are rejected before durable write, without invoking getters',()=>fixture(f=>{
 const before=f.ledger.manifest();
 let reads=0;const unstable=quote();
 Object.defineProperty(unstable,'coinMinor',{enumerable:true,get(){reads++;return reads===1?'300':'400';}});
 a.throws(()=>f.ledger.appendBatch([unstable,accept()]),/INVALID_SWAP_EVENT/);
 a.equal(reads,0);
 const hidden=quote();Object.defineProperty(hidden,'extra',{value:'unexpected'});
 const symbolic=quote();symbolic[Symbol('hidden')]='unexpected';
 for(const event of [hidden,symbolic,{...quote(),extra:undefined},{...quote(),kind:['quote_created']}])
  a.throws(()=>f.ledger.appendBatch([event]),/INVALID_SWAP_EVENT/);
 a.deepEqual(f.reopen().manifest(),before);
 a.deepEqual(f.ledger.counts(),{events:0});
 const result=f.ledger.appendBatch([quote(),accept()]);
 a.deepEqual(f.reopen().get(),result.projection);
}));
test('malformed transition cannot persist or release either reserved asset',()=>fixture(f=>{
 f.ledger.appendBatch([quote(),accept()]);
 const before=f.ledger.manifest(),held=f.ledger.get();
 for(const kind of [['swap_confirmed'],['swap_cancelled']])
  a.throws(()=>f.ledger.appendBatch([end('q',12,kind)]),/INVALID_SWAP_EVENT/);
 a.deepEqual(f.reopen().manifest(),before);
 a.deepEqual(f.ledger.get(),held);
 a.equal(f.ledger.appendBatch([end()]).status,'applied');
}));
