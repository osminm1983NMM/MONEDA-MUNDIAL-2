'use strict';
// Private lab-only PostgreSQL adapter; injected trusted pool, no connection URL,
// driver dependency, credential discovery or public server. The pool must
// already connect to the disposable database as the restricted status role.
const STATUS_SQL="SELECT order_id::text,status,principal_minor::text,fee_minor::text,total_minor::text,source_currency,payout_minor::text,payout_currency,to_char(accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS accepted_at FROM mwd_financial_lab.read_bound_order_status($1::text,$2::uuid)";
const BINDING_SQL="SELECT environment,user_id::text AS \"userId\",actor,active FROM mwd_financial_lab.resolve_status_binding($1::uuid)";
const GUARD="SELECT current_database() AS database_name,current_user AS role_name,session_user AS login_role,current_setting('transaction_read_only') AS read_only";
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function createRestrictedStatusQuery({environment,pool,maxActive=4}={}){
 if(environment!=='sandbox'||typeof pool?.connect!=='function'||!Number.isSafeInteger(maxActive)||maxActive<1||maxActive>16)throw Error('SANDBOX_ONLY');
 let active=0;
 return async function query(sql,params,signal){
  const checkAbort=()=>{if(signal?.aborted)throw Error('ABORTED');};
  checkAbort();
  const length=sql===STATUS_SQL?2:sql===BINDING_SQL?1:0;
  if(!length||!Array.isArray(params)||params.length!==length||!params.every(uuid))throw Error('QUERY_NOT_ALLOWED');
  if(active>=maxActive)throw Error('CAPACITY');
  const values=[...params];active++;
  let client,begun=false,healthy=false;
  try{
   client=await pool.connect();
   if(typeof client?.query!=='function'||typeof client.release!=='function')throw Error('INVALID_POOL');
   checkAbort();
   await client.query('BEGIN READ ONLY');begun=true;
   checkAbort();
   await client.query("SET LOCAL statement_timeout = '3000ms'");
   checkAbort();
   await client.query("SET LOCAL lock_timeout = '1000ms'");
   checkAbort();
   const check=await client.query(GUARD);
   checkAbort();
   const r=check?.rows?.[0];
   if(check?.rows?.length!==1||r?.database_name!=='mwd_financial_sandbox_test'||r.role_name!=='mwd_lab_status_service'||r.login_role!=='mwd_lab_status_service'||r.read_only!=='on')throw Error('ISOLATED_ROLE_REQUIRED');
   const result=await client.query(sql,values);
   checkAbort();
   if(!Array.isArray(result?.rows)||result.rows.length>1)throw Error('INVALID_QUERY_RESULT');
   await client.query('COMMIT');begun=false;healthy=true;
   checkAbort();
   return {rows:result.rows};
  }catch(e){
   if(begun){try{await client.query('ROLLBACK');}catch{}}
   throw Error('STATUS_QUERY_UNAVAILABLE');
  }finally{
   try{if(typeof client?.release==='function')client.release(!healthy);}finally{active--;}
  }
 };
}
module.exports={createRestrictedStatusQuery};
