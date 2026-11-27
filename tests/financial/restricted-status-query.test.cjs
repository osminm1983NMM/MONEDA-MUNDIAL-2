'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createRestrictedStatusQuery:create}=require('../../financial-sandbox/restricted-status-query.cjs');
const {createOrderStatusService}=require('../../financial-sandbox/order-status-service.cjs');
const id='00000000-0000-4000-8000-000000000001',actor='00000000-0000-4000-8000-000000000002';
const status="SELECT order_id::text,status,principal_minor::text,fee_minor::text,total_minor::text,source_currency,payout_minor::text,payout_currency,to_char(accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS accepted_at FROM mwd_financial_lab.read_bound_order_status($1::text,$2::uuid)";
const binding="SELECT environment,user_id::text AS \"userId\",actor,active FROM mwd_financial_lab.resolve_status_binding($1::uuid)";
function fixture({guard={database_name:'mwd_financial_sandbox_test',role_name:'mwd_lab_status_service',login_role:'mwd_lab_status_service',read_only:'on'},failAt}={}){
 const calls=[],releases=[];
 const pool={async connect(){calls.push(['connect']);return {
  async query(sql,params){calls.push([sql,params]);if(sql===failAt)throw Error('private');return {rows:sql.startsWith('SELECT current_database')?[guard]:[]};},
  release(destroy){releases.push(destroy);}
 };}};
 return {pool,calls,releases,query:create({environment:'sandbox',pool})};
}
test('both exact status statements execute with read-only limits and bound UUIDs',async()=>{
 const f=fixture();
 for(const [sql,params] of [[binding,[actor]],[status,[actor,id]]]){
  a.deepEqual(await f.query(sql,params),{rows:[]});
  a.deepEqual(f.calls.slice(-7).map(x=>x[0]),['connect','BEGIN READ ONLY',"SET LOCAL statement_timeout = '3000ms'","SET LOCAL lock_timeout = '1000ms'",'SELECT current_database() AS database_name,current_user AS role_name,session_user AS login_role,current_setting(\'transaction_read_only\') AS read_only',sql,'COMMIT']);
  a.deepEqual(f.calls.at(-2)[1],params);
 }
 a.deepEqual(f.releases,[false,false]);
 const service=createOrderStatusService({environment:'sandbox',verifySession:async()=>({environment:'sandbox',actor}),query:f.query});
 a.equal((await service.read({sessionToken:'fixture',orderId:id})).status,404);
});
test('wrong SQL and malformed parameters never acquire a connection',async()=>{
 const f=fixture();
 for(const [sql,params] of [['SELECT 1',[]],[status+';',[actor,id]],[status,[actor,'invalid']],[binding,[actor,id]]])await a.rejects(f.query(sql,params),/QUERY_NOT_ALLOWED/);
 a.equal(f.calls.length,0);
 a.throws(()=>create({environment:'production',pool:f.pool}),/SANDBOX_ONLY/);
});
test('wrong database, effective role, login identity or read-only state rolls back and discards connection',async()=>{
 for(const guard of [{database_name:'mwd_financial_sandbox_test',role_name:'mwd_lab_status_service',login_role:'lab',read_only:'on'},{database_name:'mwd_financial_sandbox_test',role_name:'mwd_lab_status_service',read_only:'on'},{database_name:'postgres',role_name:'mwd_lab_status_service',login_role:'mwd_lab_status_service',read_only:'on'},{database_name:'mwd_financial_sandbox_test',role_name:'lab',login_role:'mwd_lab_status_service',read_only:'on'},{database_name:'mwd_financial_sandbox_test',role_name:'mwd_lab_status_service',login_role:'mwd_lab_status_service',read_only:'off'}]){
  const f=fixture({guard});await a.rejects(f.query(status,[actor,id]),/STATUS_QUERY_UNAVAILABLE/);
  a.equal(f.calls.some(x=>x[0]===status),false);a.equal(f.calls.at(-1)[0],'ROLLBACK');a.deepEqual(f.releases,[true]);
 }
});
test('query or commit failure discards connection and releases capacity',async()=>{
 for(const failAt of [status,'COMMIT']){
  const f=fixture({failAt});for(let i=0;i<5;i++)await a.rejects(f.query(status,[actor,id]),/STATUS_QUERY_UNAVAILABLE/);
  a.deepEqual(f.releases,Array(5).fill(true));a.equal(f.calls.at(-1)[0],'ROLLBACK');
 }
});
test('pool acquisition backlog is bounded until actual acquisition settles',async()=>{
 let resolve;const pool={connect:()=>new Promise(r=>{resolve=r;})};
 const query=create({environment:'sandbox',pool,maxActive:1});
 const pending=query(binding,[actor]);await a.rejects(query(binding,[actor]),/CAPACITY/);
 resolve(null);await a.rejects(pending,/STATUS_QUERY_UNAVAILABLE/);
});

test('cancelled pool acquisition cannot begin a transaction and releases capacity',async()=>{
 const ctrl=new AbortController(),calls=[],releases=[];
 let resolve;
 const pool={connect:()=>new Promise(r=>{resolve=r;})};
 const query=create({environment:'sandbox',pool,maxActive:1});
 const pending=query(binding,[actor],ctrl.signal);ctrl.abort();
 await a.rejects(query(binding,[actor]),/CAPACITY/);
 resolve({query:async(sql)=>{calls.push(sql);return {rows:[]};},release:destroy=>releases.push(destroy)});
 await a.rejects(pending,/STATUS_QUERY_UNAVAILABLE/);
 a.deepEqual(calls,[]);a.deepEqual(releases,[true]);
 await a.rejects(query(binding,[actor],ctrl.signal),/ABORTED/);
});
test('cancellation after guard rolls back without starting the status statement',async()=>{
 const ctrl=new AbortController(),calls=[],releases=[];
 const pool={connect:async()=>({
  async query(sql){calls.push(sql);if(sql.startsWith('SELECT current_database')){ctrl.abort();return {rows:[{database_name:'mwd_financial_sandbox_test',role_name:'mwd_lab_status_service',login_role:'mwd_lab_status_service',read_only:'on'}]};}return {rows:[]};},
  release:destroy=>releases.push(destroy)
 })};
 const query=create({environment:'sandbox',pool});
 await a.rejects(query(status,[actor,id],ctrl.signal),/STATUS_QUERY_UNAVAILABLE/);
 a.ok(!calls.includes(status));a.equal(calls.at(-1),'ROLLBACK');a.deepEqual(releases,[true]);
});
