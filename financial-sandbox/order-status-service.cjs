'use strict';
// Offline server integration boundary. The caller supplies a trusted session
// verifier and a private PostgreSQL query adapter. No HTTP listener, credentials,
// JWT implementation, provider access or production activation.
const actorId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const {validOrderStatus}=require('./order-status-contract.cjs');
const result=(status,body)=>({status,body});
const error=(status,code)=>result(status,{mode:'sandbox',error:code});
// Cast int8 to text before decoding to avoid an adapter's number conversion.
const SQL="SELECT order_id::text,status,principal_minor::text,fee_minor::text,total_minor::text,source_currency,payout_minor::text,payout_currency,to_char(accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS accepted_at FROM mwd_financial_lab.read_bound_order_status($1::text,$2::uuid)";
function normalize(row,orderId){
 const keys=['order_id','status','principal_minor','fee_minor','total_minor','source_currency','payout_minor','payout_currency','accepted_at'];
 if(!exact(row,keys)||row.order_id!==orderId)throw Error('INVALID_STATUS_ROW');
 const value={mode:'sandbox',orderId,status:row.status,
  source:{currency:row.source_currency,principalMinor:row.principal_minor,feeMinor:row.fee_minor,totalMinor:row.total_minor},
  destination:{currency:row.payout_currency,amountMinor:row.payout_minor},acceptedAt:row.accepted_at};
 if(!validOrderStatus(value,orderId))throw Error('INVALID_STATUS_ROW');
 return value;
}
function createOrderStatusService({environment,verifySession,query}={}){
 if(environment!=='sandbox'||typeof verifySession!=='function'||typeof query!=='function')throw Error('SANDBOX_ONLY');
 return Object.freeze({
  async read(request,signal){
   // The actor is never accepted from the request. An opaque session token
   // must be validated by a trusted server-side verifier supplied by the host.
   if(!exact(request,['sessionToken','orderId']))return error(400,'INVALID_REQUEST');
   const {sessionToken,orderId}=request;
   if(typeof sessionToken!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(sessionToken))return error(401,'AUTH_REQUIRED');
   // Reject malformed requests before invoking the identity provider.
   if(!uuid(orderId))return error(400,'INVALID_REQUEST');
   if(signal?.aborted)return error(503,'UNAVAILABLE');
   let session;
   try{session=await verifySession(sessionToken);}catch{return error(503,'UNAVAILABLE');}
   // Do not start a database read after a cancelled identity check.
   if(signal?.aborted)return error(503,'UNAVAILABLE');
   if(!exact(session,['environment','actor'])||session.environment!=='sandbox'||!actorId(session.actor))return error(401,'AUTH_REQUIRED');
   const actor=session.actor;
   try{
    const response=await query(SQL,[actor,orderId]);
    if(signal?.aborted)return error(503,'UNAVAILABLE');
    if(!Array.isArray(response?.rows)||response.rows.length>1)return error(503,'UNAVAILABLE');
    if(response.rows.length===0)return error(404,'NOT_FOUND');
    return result(200,normalize(response.rows[0],orderId));
   }catch{return error(503,'UNAVAILABLE');}
  }
 });
}
module.exports={createOrderStatusService};
