'use strict';
// Assembly of existing status-only laboratory components. No driver creation,
// credential discovery, network destination selection, or live authorization.
const {createRestrictedStatusQuery}=require('./restricted-status-query.cjs');
const {createSupabaseOrderStatus}=require('./supabase-order-status-auth.cjs');
const {createOrderStatusLoopback}=require('./order-status-loopback.cjs');
function createStatusLabServer({environment,enabled=false,authClient,pool}={}){
 if(environment!=='sandbox'||enabled!==true)throw Error('STATUS_LAB_DISABLED');
 // Deliberately no override for the binding resolver or raw SQL service.
 const query=createRestrictedStatusQuery({environment,pool,maxActive:4});
 const service=createSupabaseOrderStatus({environment,authClient,query});
 const listener=createOrderStatusLoopback({environment,service,maxActive:8,maxConnections:16,bodyTimeoutMs:5000,serviceTimeoutMs:10000});
 let state='idle',starting=null,closing=null;
 return Object.freeze({
  start(){
   if(state!=='idle')return Promise.reject(Error('INVALID_LISTENER_STATE'));
   state='starting';
   starting=listener.start(0).then(origin=>{
    if(state==='starting')state='running';
    return origin;
   },error=>{
    if(state==='starting')state='closed';
    throw error;
   });
   return starting;
  },
  close(){
   if(closing)return closing;
   state='closing';
   closing=(async()=>{
    try{if(starting)await starting.catch(()=>{});await listener.close();}
    finally{state='closed';}
   })();
   return closing;
  }
 });
}
module.exports={createStatusLabServer};
