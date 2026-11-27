'use strict';
// Offline server integration boundary. The caller supplies a trusted session
// verifier and a private PostgreSQL query adapter. No HTTP listener, credentials,
// JWT implementation, provider access or production activation.
const actorId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const states=new Set(['funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded']);
const integer=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(v);
const result=(status,body)=>({status,body});
const error=(status,code)=>result(status,{mode:'sandbox',error:code});
// Cast int8 to text before decoding to avoid an adapter's number conversion.
const SQL="SELECT order_id::text,status,principal_minor::text,fee_minor::text,total_minor::text,source_currency,payout_minor::text,payout_currency,to_char(accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS accepted_at FROM mwd_financial_lab.read_bound_order_status($1::text,$2::uuid)";
function normalize(row,orderId){
 const keys=['order_id','status','principal_minor','fee_minor','total_minor','source_currency','payout_minor','payout_currency','accepted_at'];
 if(!exact(row,keys)||row.order_id!==orderId||!states.has(row.status)||row.source_currency!=='USD'||row.payout_currency!=='HNL'||
 ![row.principal_minor,row.fee_minor,row.total_minor,row.payout_minor].every(integer)||
 typeof row.accepted_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.accepted_at))throw Error('INVALID_STATUS_ROW');
 const time=new Date(row.accepted_at);
 if(!Number.isFinite(time.getTime())||time.toISOString()!==row.accepted_at)throw Error('INVALID_STATUS_ROW');
 const p=BigInt(row.principal_minor),f=BigInt(row.fee_minor),t=BigInt(row.total_minor),dest=BigInt(row.payout_minor);
 if(p===0n||dest===0n||p+f!==t||[p,f,t,dest].some(n=>n>9223372036854775807n))throw Error('INVALID_STATUS_ROW');
 return {mode:'sandbox',orderId,status:row.status,source:{currency:'USD',principalMinor:String(p),feeMinor:String(f),totalMinor:String(t)},
 destination:{currency:'HNL',amountMinor:String(dest)},acceptedAt:row.accepted_at};
}
function createOrderStatusService({environment,verifySession,query}={}){
 if(environment!=='sandbox'||typeof verifySession!=='function'||typeof query!=='function')throw Error('SANDBOX_ONLY');
 return Object.freeze({
  async read(request){
   // The actor is never accepted from the request. An opaque session token
   // must be validated by a trusted server-side verifier supplied by the host.
   if(!exact(request,['sessionToken','orderId']))return error(400,'INVALID_REQUEST');
   const {sessionToken,orderId}=request;
   if(typeof sessionToken!=='string'||sessionToken.length<1||sessionToken.length>8192||/\s/.test(sessionToken))return error(401,'AUTH_REQUIRED');
   let session;
   try{session=await verifySession(sessionToken);}catch{return error(503,'UNAVAILABLE');}
   if(!exact(session,['environment','actor'])||session.environment!=='sandbox'||!actorId(session.actor))return error(401,'AUTH_REQUIRED');
   if(!uuid(orderId))return error(400,'INVALID_REQUEST');
   const actor=session.actor;
   try{
    const response=await query(SQL,[actor,orderId]);
    if(!Array.isArray(response?.rows)||response.rows.length>1)return error(503,'UNAVAILABLE');
    if(response.rows.length===0)return error(404,'NOT_FOUND');
    return result(200,normalize(response.rows[0],orderId));
   }catch{return error(503,'UNAVAILABLE');}
  }
 });
}
module.exports={createOrderStatusService};
