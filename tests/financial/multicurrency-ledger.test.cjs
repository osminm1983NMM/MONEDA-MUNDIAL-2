'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {openMulticurrencyLedger}=require('../../financial-sandbox/multicurrency-ledger.cjs');
const order={mode:'sandbox',id:'order-1',principalUsdMinor:10000,feeUsdMinor:150,payoutHnlMinor:250000};
const event=(eventId,type,fields={})=>({mode:'sandbox',orderId:order.id,eventId,type,...fields});
const funding=event('funding','funding_confirmed',{usdMinor:10150});
const fx=event('fx','fx_acquired',{usdMinor:10000,hnlMinor:250000,costUsdMinor:40});
const payout=event('payout','payout_confirmed',{hnlMinor:250000});
const failed=event('failed','payout_failed');
const unwind=event('unwind','fx_unwound',{usdMinor:10000,hnlMinor:250000,costUsdMinor:20});
const refund=event('refund','refund_confirmed',{usdMinor:10150});
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'mwd-multi-'));
 const config={environment:'sandbox',path:join(dir,'ledger.sqlite')};
 let store;
 try{store=openMulticurrencyLedger({...config,initialize:true});fn({config,store,reopen(){store.close();store=openMulticurrencyLedger(config);return store;}});}
 finally{if(store)store.close();rmSync(dir,{recursive:true,force:true});}
}
test('restart reconstructs journal and preserves current state on replay',()=>fixture(({store,reopen})=>{
 a.equal(store.create(order).status,'created');
 store.append(order.id,funding);store.append(order.id,fx);
 const before=store.get(order.id);store=reopen();a.deepEqual(store.get(order.id),before);
 const paid=store.append(order.id,payout).projection;a.equal(paid.state,'paid');
 store=reopen();a.deepEqual(store.get(order.id),paid);
 a.deepEqual(store.append(order.id,{...funding}),{status:'duplicate',projection:paid});
 a.deepEqual(store.create({...order}),{status:'duplicate',projection:paid});
 a.deepEqual(store.counts(),{orders:1,events:3});
}));
test('invalid transitions and conflicting replays leave durable history unchanged',()=>fixture(({store})=>{
 store.create(order);a.throws(()=>store.append(order.id,payout),/INVALID_TRANSITION/);
 store.append(order.id,funding);const before=store.get(order.id);
 a.throws(()=>store.append(order.id,{...funding,usdMinor:10151}),/EVENT_ID_CONFLICT/);
 a.throws(()=>store.create({...order,feeUsdMinor:151}),/ORDER_ID_CONFLICT/);
 a.throws(()=>store.append(order.id,{...fx,hnlMinor:250001}),/AMOUNT_MISMATCH/);
 a.deepEqual(store.get(order.id),before);a.deepEqual(store.counts(),{orders:1,events:1});
}));
test('converted payout failure persists through restart and full refund',()=>fixture(({store,reopen})=>{
 store.create(order);for(const e of [funding,fx,failed])store.append(order.id,e);
 store=reopen();a.equal(store.get(order.id).state,'payout_failed_converted');
 a.throws(()=>store.append(order.id,refund),/INVALID_TRANSITION/);
 store.append(order.id,unwind);store=reopen();
 const x=store.append(order.id,refund).projection;
 a.equal(x.state,'refunded');a.equal(x.balances.USD.customer_payable,'0');
 a.deepEqual(x.cashShortfallMinor,{USD:'60',HNL:'0'});a.equal(x.balanced,true);
}));
test('two connections cannot reuse an event ID for a different order',()=>fixture(({store,config})=>{
 const other=openMulticurrencyLedger(config);
 try{
  store.create(order);other.create({...order,id:'order-2'});
  store.append(order.id,funding);
  a.throws(()=>other.append('order-2',{...funding,orderId:'order-2'}),/EVENT_ID_CONFLICT/);
  a.equal(other.get('order-2').state,'awaiting_funding');
  a.deepEqual(other.counts(),{orders:2,events:1});
  a.equal(other.append(order.id,funding).status,'duplicate');
 }finally{other.close();}
}));
test('explicit isolated creation and ordinary append-only controls',()=>fixture(({store,config})=>{
 a.throws(()=>openMulticurrencyLedger({...config,environment:'production'}),/SANDBOX_ONLY/);
 a.throws(()=>openMulticurrencyLedger({...config,path:config.path+'.missing.sqlite'}),/LEDGER_MISSING/);
 a.throws(()=>openMulticurrencyLedger({...config,initialize:true}),/EEXIST/);
 a.throws(()=>store.create({...order,secret:'x'}),/INVALID_ORDER/);
 store.create(order);store.append(order.id,funding);
 const db=new DatabaseSync(config.path);
 try{for(const sql of ["UPDATE orders SET payload='{}'","DELETE FROM orders","UPDATE events SET payload='{}'","DELETE FROM events"])a.throws(()=>db.exec(sql),/APPEND_ONLY/);}
 finally{db.close();}
 a.equal(store.get(order.id).state,'funded');
}));
