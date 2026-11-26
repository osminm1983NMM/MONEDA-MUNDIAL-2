const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('App.js','utf8');
const start=source.indexOf('async function loadPickupOrders(');
const end=source.indexOf('function navigate(',start);
assert.ok(start>=0 && end>start);
const body=source.slice(start,end);
function harness(){
 let actor='A',orders=[],busy=false,alerts=[],calls=[];
 const list={current:false},cancel={current:false};
 const api=new Function('userId','isCurrentUser','pickupOrdersBusyRef','pickupCancelBusyRef','setPickupOrdersBusy','setPickupCancelBusy','setPickupOrders','message','supabase',body+';return {loadPickupOrders,cancelDemoPickup};')('A',id=>id===actor,list,cancel,v=>{busy=v;},()=>{},v=>{orders=v;},(...v)=>alerts.push(v),{rpc:(name)=>new Promise(resolve=>calls.push({name,resolve}))});
 return {...api,calls,state:()=>({orders,busy,alerts}),switchAccount:()=>{actor='B';list.current=false;}};
}
test('confirmed cancellation supersedes older list response',async()=>{
 const h=harness(),old=h.loadPickupOrders(),cancel=h.cancelDemoPickup('order');
 h.calls[1].resolve({data:{status:'cancelled',orderId:'order'}});
 await Promise.resolve();
 assert.equal(h.calls.length,3);
 h.calls[0].resolve({data:[{status:'pending'}]});await old;
 assert.equal(h.state().busy,true);assert.deepEqual(h.state().orders,[]);
 h.calls[2].resolve({data:[{status:'cancelled'}]});await cancel;
 assert.deepEqual(h.state().orders,[{status:'cancelled'}]);assert.equal(h.state().busy,false);
});
test('late error from superseded list cannot display alert or unlock newer request',async()=>{
 const h=harness(),a=h.loadPickupOrders(),b=h.loadPickupOrders(true);
 h.calls[0].resolve({error:{message:'old error'}});await a;
 assert.equal(h.state().busy,true);assert.deepEqual(h.state().alerts,[]);
 h.calls[1].resolve({data:[]});await b;assert.equal(h.state().busy,false);
});
test('normal duplicate tap, including UI event, does not start another read',async()=>{
 const h=harness(),a=h.loadPickupOrders();await h.loadPickupOrders({nativeEvent:{}});
 assert.equal(h.calls.length,1);h.calls[0].resolve({data:[]});await a;
});
test('account change discards obsolete order response',async()=>{
 const h=harness(),a=h.loadPickupOrders();h.switchAccount();
 h.calls[0].resolve({data:[{status:'pending'}]});await a;assert.deepEqual(h.state().orders,[]);
});
