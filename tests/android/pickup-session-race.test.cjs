const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const body=source.slice(source.indexOf('async function recoverPendingPickup('),source.indexOf('function navigate('));
function harness(){
 let actor='A',reads=[],calls=[],alerts=[],visible=[],errors=[];
 const busy={current:false},cancel={current:false},list={current:false},pending={current:null};
 const api=new Function('userId','isCurrentUser','pickupBusyRef','pickupCancelBusyRef','pickupOrdersBusyRef','setPickupBusy','setPickupCancelBusy','setPickupOrdersBusy','setPickupPendingError','AsyncStorage','pendingPickupStorageKey','parsePendingPickup','pickupPendingRef','setPendingPickup','setPickupAmount','formatMWD','message','supabase','setPickupOrders',body+';return {recoverPendingPickup,cancelDemoPickup};')('A',id=>id===actor,busy,cancel,list,()=>{},()=>{},()=>{},v=>errors.push(v),{getItem:()=>new Promise(resolve=>reads.push(resolve))},id=>id,JSON.parse,pending,v=>visible.push(v),()=>{},v=>String(v),(...v)=>alerts.push(v),{rpc:name=>new Promise(resolve=>calls.push({name,resolve}))},()=>{});
 return {...api,reads,calls,alerts,visible,errors,busy,cancel,cycle:()=>{actor='B';busy.current=false;cancel.current=false;list.current=false;actor='A';}};
}
test('A-B-A old pickup recovery cannot overwrite new pending reference or unlock',async()=>{
 const h=harness(),old=h.recoverPendingPickup();h.cycle();const fresh=h.recoverPendingPickup();
 h.reads[0](JSON.stringify({id:'old',cents:100}));await old;
 assert.equal(h.visible.length,0);assert.ok(h.busy.current);
 h.reads[1](JSON.stringify({id:'new',cents:200}));await fresh;
 assert.equal(h.visible[0].id,'new');assert.equal(h.busy.current,false);
});
test('A-B-A old cancellation cannot display alert, refresh or release newer lock',async()=>{
 const h=harness(),old=h.cancelDemoPickup('old');h.cycle();const fresh=h.cancelDemoPickup('new');
 h.calls[0].resolve({data:{status:'cancelled',orderId:'old'}});await old;
 assert.equal(h.alerts.length,0);assert.equal(h.calls.length,2);assert.ok(h.cancel.current);
 h.calls[1].resolve({data:{status:'cancelled',orderId:'new'}});await Promise.resolve();
 assert.equal(h.calls[2].name,'mwd_pickup_my_orders_demo');
 h.calls[2].resolve({data:[]});await fresh;
 assert.equal(h.alerts.length,1);assert.equal(h.cancel.current,false);
});
test('A-B-A old rejected cancellation does not display error or release newer lock',async()=>{
 const h=harness(),old=h.cancelDemoPickup('old');h.cycle();const fresh=h.cancelDemoPickup('new');
 h.calls[0].resolve({error:{message:'old'}});await old;
 assert.equal(h.alerts.length,0);assert.ok(h.cancel.current);
 h.calls[1].resolve({error:{message:'new'}});await fresh;
 assert.equal(h.alerts.length,1);assert.equal(h.cancel.current,false);
});
