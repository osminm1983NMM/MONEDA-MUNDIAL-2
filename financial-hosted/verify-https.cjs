'use strict';
// Manual hosted LAB acceptance only. No signup, payments, or privileged key.
// Run on a trusted workstation. Never put passwords or tokens in GitHub or logs.
// Use two authorized synthetic Auth users and their pre-seeded funding_pending orders.
// Env: MWD_LAB_PUBLISHABLE_KEY, MWD_LAB_A_EMAIL, MWD_LAB_A_PASSWORD,
// MWD_LAB_A_ORDER, MWD_LAB_B_EMAIL, MWD_LAB_B_PASSWORD, MWD_LAB_B_ORDER.
// Expected totals: A 10150 USD minor units; B 20250 USD minor units.
// Run: node financial-hosted/verify-https.cjs
const origin='https://tfamyuqqpenilnovqjpp.supabase.co';
async function runProof({signIn,read,signOut,anonRead,fixtures}){
 const sessions=[];
 const check=(v,label)=>{if(!v)throw Error(label);};
 try{
  check(await anonRead(fixtures[0].order),"ANONYMOUS_NOT_DENIED");
  for(const f of fixtures){const s=await signIn(f);check(s&&typeof s.token==="string"&&typeof s.userId==="string"&&!s.anonymous,"LOGIN_FAILED");sessions.push(s);}
  check(sessions[0].userId!==sessions[1].userId&&sessions[0].token!==sessions[1].token,"DISTINCT_USERS_REQUIRED");
  for(let i=0;i<2;i++){
   const own=await read(sessions[i].token,fixtures[i].order);
   check(own.ok&&own.value.status==="funding_pending"&&own.value.source.totalMinor===fixtures[i].total,"OWNER_OR_AMOUNT_MISMATCH_"+i);
   const other=await read(sessions[i].token,fixtures[1-i].order);
   check(!other.ok&&other.code==="NOT_FOUND","CROSS_ACCOUNT_NOT_DENIED_"+i);
  }
  for(let i=0;i<2;i++){
   await signOut(sessions[i]);
   const revoked=await read(sessions[i].token,fixtures[i].order);
   check(!revoked.ok&&["NOT_FOUND","AUTH_REQUIRED"].includes(revoked.code),"REVOKED_SESSION_NOT_DENIED_"+i);
  }
  return "PASS: anonymous denial, two owners, cross-account isolation in both directions, and revocation of both sessions.";
 }finally{await Promise.allSettled(sessions.map(s=>signOut(s)));}
}
async function main(){
 const {createClient}=require('@supabase/supabase-js');
 const {createOrderStatusClient}=require('../financial-sandbox/order-status-client.cjs');
 const env=process.env;
 const key=env.MWD_LAB_PUBLISHABLE_KEY;
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
 const fixtures=['A','B'].map((name,i)=>({email:env['MWD_LAB_'+name+'_EMAIL'],password:env['MWD_LAB_'+name+'_PASSWORD'],order:env['MWD_LAB_'+name+'_ORDER'],total:i?'20250':'10150'}));
 if(!/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(key||'')||fixtures.some(f=>!f.email||!f.password||!uuid.test(f.order||''))||fixtures[0].email.toLowerCase()===fixtures[1].email.toLowerCase()||fixtures[0].order===fixtures[1].order)throw Error('LAB_CONFIGURATION_REQUIRED');
 const client=createOrderStatusClient({environment:'sandbox',sandboxOrigin:origin,transport:'hosted-rpc',publishableKey:key});
 const boundedFetch=(url,opts={})=>fetch(url,{...opts,redirect:'error',signal:opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
 const result=await runProof({
  fixtures,
  async anonRead(order){
   const response=await boundedFetch(origin+'/rest/v1/rpc/mwd_lab_read_status',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify({p_order:order})});
   await response.body?.cancel();
   return [401,403,404].includes(response.status);
  },
  async signIn(f){
   const authClient=createClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
   const {data,error}=await authClient.auth.signInWithPassword({email:f.email,password:f.password});
   if(error||!data?.session?.access_token||!data?.user?.id||data.user.is_anonymous!==false){await authClient.auth.signOut({scope:'local'}).catch(()=>{});throw Error('LOGIN_FAILED');}
   return {token:data.session.access_token,userId:data.user.id,anonymous:data.user.is_anonymous,authClient,closed:false};
  },
  read:(token,order)=>client.read({sessionToken:token,orderId:order}),
  async signOut(s){
   if(s.closed)return;
   const {error}=await s.authClient.auth.signOut({scope:'local'});
   if(error)throw Error('LOGOUT_FAILED');
   s.closed=true;
  }
 });
 console.log(result);
}
module.exports={runProof};
if(require.main===module)main().catch(e=>{const code=String(e?.message||'');console.error(/^(LAB_CONFIGURATION_REQUIRED|LOGIN_FAILED|LOGOUT_FAILED|ANONYMOUS_NOT_DENIED|DISTINCT_USERS_REQUIRED|(?:OWNER_OR_AMOUNT_MISMATCH|CROSS_ACCOUNT_NOT_DENIED|REVOKED_SESSION_NOT_DENIED)_[01])$/.test(code)?code:'HOSTED_PROOF_FAILED');process.exitCode=1;});
