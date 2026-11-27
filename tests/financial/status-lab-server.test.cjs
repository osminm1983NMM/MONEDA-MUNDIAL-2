'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createStatusLabServer:create}=require('../../financial-sandbox/status-lab-server.cjs');
const {route}=require('../../financial-sandbox/order-status-route.cjs');
const owner='00000000-0000-4000-8000-000000000071',other='00000000-0000-4000-8000-000000000072',orderId='00000000-0000-4000-8000-000000000001';
function fixture({wrongRole=false,wrongLogin=false}={}){
 const calls=[],releases=[];
 const authClient={auth:{async getUser(token){
  calls.push(['auth',token]);
  const id=token==='owner-token'?owner:token==='other-token'?other:null;
  return id?{data:{user:{id,role:'authenticated',is_anonymous:false}},error:null}:{error:{status:401}};
 }}};
 const pool={async connect(){return {
  async query(sql,params){
   calls.push([sql,params]);
   if(sql.startsWith('SELECT current_database'))return {rows:[{database_name:'mwd_financial_sandbox_test',role_name:wrongRole?'lab':'mwd_lab_status_service',login_role:wrongLogin?'lab':'mwd_lab_status_service',read_only:'on'}]};
   if(sql.includes('resolve_status_binding'))return {rows:[{environment:'sandbox',userId:params[0],actor:params[0],active:true}]};
   if(sql.includes('read_bound_order_status'))return {rows:params[0]===owner&&params[1]===orderId?[{order_id:orderId,status:'paid',principal_minor:'10000',fee_minor:'150',total_minor:'10150',source_currency:'USD',payout_minor:'250000',payout_currency:'HNL',accepted_at:'2026-11-26T15:00:00.000Z'}]:[]};
   return {rows:[]};
  },
  release(destroy){releases.push(destroy);}
 };}};
 return {authClient,pool,calls,releases};
}
const request=(origin,token)=>fetch(origin+route,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({orderId})});
test('server is opt-in, loopback-only, one lifecycle and no direct query interface',async()=>{
 const f=fixture();
 for(const config of [{environment:'production',enabled:true},{environment:'sandbox'},{environment:'sandbox',enabled:'true'}])a.throws(()=>create({...f,...config}),/STATUS_LAB_DISABLED/);
 const s=create({...f,environment:'sandbox',enabled:true});
 a.deepEqual(Object.keys(s),['start','close']);
 a.equal(f.calls.length,0);
 try{
  const pending=s.start();await a.rejects(s.start(),/INVALID_LISTENER_STATE/);
  const origin=await pending;a.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  const r=await request(origin,'owner-token');a.equal(r.status,200);a.equal(r.headers.get('cache-control'),'no-store');
  const value=await r.json();a.equal(value.orderId,orderId);a.equal(value.source.totalMinor,'10150');
  const denied=await request(origin,'other-token');a.equal(denied.status,404);a.deepEqual(await denied.json(),{mode:'sandbox',error:'NOT_FOUND'});
  const before=f.calls.length;
  const unauth=await request(origin,'invalid-token');a.equal(unauth.status,401);await unauth.json();
  a.deepEqual(f.calls.slice(before),[['auth','invalid-token']]);
  a.deepEqual(f.releases,[false,false,false,false]);
 }finally{await s.close();}
 await a.rejects(s.start(),/INVALID_LISTENER_STATE/);
});
test('wrong database role cannot expose order status via composed listener',async()=>{
 const f=fixture({wrongRole:true}),s=create({...f,environment:'sandbox',enabled:true});
 try{
  const origin=await s.start(),r=await request(origin,'owner-token');
  a.equal(r.status,503);a.deepEqual(await r.json(),{mode:'sandbox',error:'UNAVAILABLE'});
  a.ok(!f.calls.some(([sql])=>sql.includes('resolve_status_binding')||sql.includes('read_bound_order_status')));
  a.deepEqual(f.releases,[true]);
 }finally{await s.close();}
});
test('close before or during startup is terminal and idempotent',async()=>{
 const f=fixture(),config={...f,environment:'sandbox',enabled:true};
 const a1=create(config);await a1.close();await a.rejects(a1.start(),/INVALID_LISTENER_STATE/);
 const a2=create(config),starting=a2.start(),closing=a2.close();
 await starting;await closing;await a2.close();await a.rejects(a2.start(),/INVALID_LISTENER_STATE/);
 a.equal(f.calls.length,0);
});

test('administrative login with restricted effective role cannot expose remittance status',async()=>{
 const f=fixture({wrongLogin:true}),s=create({...f,environment:'sandbox',enabled:true});
 try{
  const origin=await s.start(),r=await request(origin,'owner-token');
  a.equal(r.status,503);a.deepEqual(await r.json(),{mode:'sandbox',error:'UNAVAILABLE'});
  a.ok(!f.calls.some(([sql])=>sql.includes('resolve_status_binding')||sql.includes('read_bound_order_status')));
  a.deepEqual(f.releases,[true]);
 }finally{await s.close();}
});
