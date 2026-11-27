'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {presentStatus,createStatusPresentation}=require('../../financial-sandbox/order-status-presentation.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const value={mode:'sandbox',orderId,status:'paid',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
test('all states are visibly synthetic; formatting never converts financial amounts to Number',()=>{
 for(const status of ['funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded']){
  const v=presentStatus({...value,status},'es');a.match(v.warning,/SIN DINERO REAL/);a.equal(v.total,'101,50 USD');a.equal(v.destination,'2.500,00 HNL');
 }
 a.equal(presentStatus(value,'en').statusLabel,'Payout confirmed in test');
 a.equal(presentStatus({...value,source:{...value.source,principalMinor:'9007199254740993'}},'en').principal,'90,071,992,547,409.93 USD');
 a.throws(()=>presentStatus({...value,mode:'production'}));
});
test('switching session or signing out clears screen and ignores delayed response',async()=>{
 const states=[],requests=[];
 const ui=createStatusPresentation({onChange:s=>states.push(s),client:{read:input=>new Promise(resolve=>requests.push({input,resolve}))}});
 ui.setSession('old-token');const first=ui.read(orderId);ui.setSession('new-token');const second=ui.read(orderId);
 requests[0].resolve({ok:true,value});await first;a.equal(states.at(-1).state,'loading');
 requests[1].resolve({ok:true,value});await second;a.equal(states.at(-1).state,'ready');
 const third=ui.read(orderId);ui.setSession(null);requests[2].resolve({ok:true,value});await third;
 a.deepEqual(states.at(-1),{state:'signed_out'});a.equal(requests[1].input.sessionToken,'new-token');
});
test('new query, clear and dispose prevent stale or private values from being displayed',async()=>{
 const states=[],requests=[];
 const ui=createStatusPresentation({onChange:s=>states.push(s),client:{read:()=>new Promise(resolve=>requests.push(resolve))}});
 ui.setSession('token');const first=ui.read(orderId);const second=ui.read(orderId);
 requests[1]({ok:false,code:'private diagnostic'});await second;requests[0]({ok:true,value});await first;
 a.deepEqual(states.at(-1),{state:'error',code:'UNAVAILABLE'});
 const third=ui.read(orderId);ui.clear();requests[2]({ok:true,value});await third;a.deepEqual(states.at(-1),{state:'idle'});
 const fourth=ui.read(orderId);ui.dispose();const count=states.length;requests[3]({ok:true,value});await fourth;a.equal(states.length,count);
});

test('synchronous invalidation during loading prevents transport with a stale token',async()=>{
 for(const action of [ui=>ui.setSession(null),ui=>ui.setSession('new-token'),ui=>ui.clear(),ui=>ui.dispose()]){
  let calls=0;const states=[];
  const ui=createStatusPresentation({
   onChange:s=>{states.push(s);if(s.state==='loading')action(ui);},
   client:{read:async()=>{calls++;return {ok:true,value};}}
  });
  ui.setSession('old-token');await ui.read(orderId);
  a.equal(calls,0);a.ok(!states.some(s=>s.state==='ready'));
 }
});
