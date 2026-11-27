'use strict';
// Server-only adapter for an explicitly isolated Supabase Auth client.
// Host must configure the approved test project, never a request-selected URL,
// a shared mobile session, a production project or a service-role key.
const {createOrderStatusService}=require('./order-status-service.cjs');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function createSupabaseOrderStatus({environment,authClient,resolveBinding,query}={}){
 if(environment!=='sandbox'||typeof authClient?.auth?.getUser!=='function'||typeof resolveBinding!=='function'||typeof query!=='function')throw Error('SANDBOX_ONLY');
 const getUser=authClient.auth.getUser.bind(authClient.auth);
 return createOrderStatusService({environment,query,verifySession:async token=>{
  // Always pass the supplied token explicitly; never read a cached session.
  const response=await getUser(token);
  if(!response||typeof response!=='object')throw Error('AUTH_UNAVAILABLE');
  if(response.error){
   if([400,401,403].includes(response.error.status))return null;
   throw Error('AUTH_UNAVAILABLE');
  }
  const user=response.data?.user;
  if(!user||!uuid(user.id)||user.is_anonymous!==false||user.role!=='authenticated')return null;
  // Resolve an independently provisioned server-owned binding. Do not trust
  // user_metadata, app_metadata, email or client-selected actor for ownership.
  const binding=await resolveBinding(user.id);
  if(binding===null)return null;
  if(!binding||binding.environment!=='sandbox'||binding.userId!==user.id||
   binding.actor!==user.id||typeof binding.active!=='boolean')throw Error('INVALID_BINDING');
  if(!binding.active)return null;
  return {environment:'sandbox',actor:user.id};
 }});
}
module.exports={createSupabaseOrderStatus};
