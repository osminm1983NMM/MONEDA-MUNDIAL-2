'use strict';
// Manual HTTPS acceptance for two previously enrolled synthetic LAB users.
// No signup, seeding, writes to ledger, or real assets. Never log private data.
const {isDeepStrictEqual}=require('node:util');
const {buildWalletAcceptanceFixture}=require('../financial-sandbox/wallet-acceptance-fixture.cjs');
const {createPortfolioClient}=require('../financial-sandbox/digital-coin-portfolio-client.cjs');
const origin='https://tfamyuqqpenilnovqjpp.supabase.co';
const check=(v,c)=>{if(!v)throw Error(c);};
async function runProof({exportedAt,fixtures,signIn,read,signOut,anonRead}){
 const expected=buildWalletAcceptanceFixture(exportedAt);
 check(Array.isArray(fixtures)&&fixtures.length===2,'LAB_CONFIGURATION_REQUIRED');
 const sessions=[];
 try{
  check(await anonRead(),'ANONYMOUS_NOT_DENIED');
  for(const f of fixtures){
   const s=await signIn(f);
   if(s)sessions.push(s);
   check(s&&typeof s.token==='string'&&s.token.length>0&&typeof s.userId==='string'&&s.userId.length>0&&s.anonymous===false,'LOGIN_FAILED');
  }
  check(sessions[0].userId!==sessions[1].userId&&sessions[0].token!==sessions[1].token,'DISTINCT_USERS_REQUIRED');
  async function own(i,code){
   const result=await read(sessions[i].token);
   check(result?.ok===true&&isDeepStrictEqual(result.value,expected.portfolios[i].portfolio)&&
     isDeepStrictEqual(result.snapshot,{kind:expected.kind,exportedAt:expected.exportedAt}),code);
  }
  async function denied(i){
   const revoked=await read(sessions[i].token);
   check(revoked?.ok===false&&revoked.code==='AUTH_REQUIRED','REVOKED_SESSION_NOT_DENIED_'+i);
  }
  for(let i=0;i<2;i++)await own(i,'WALLET_SNAPSHOT_MISMATCH_'+i);
  await signOut(sessions[0]);
  await denied(0);
  // A global outage or shared revocation must not be mistaken for isolation.
  await own(1,'UNRELATED_SESSION_LOST');
  await signOut(sessions[1]);
  await denied(1);
  await denied(0);
  return 'PASS: anonymous denial, two distinct exact dated synthetic wallets, independent session revocation, and continued access for the other user.';
 }finally{await Promise.allSettled(sessions.map(s=>Promise.resolve().then(()=>signOut(s))));}
}
async function runHostedProof({env,createAuthClient,fetchImpl}){
 const key=env.MWD_LAB_PUBLISHABLE_KEY,exportedAt=env.MWD_LAB_WALLET_EXPORTED_AT;
 const fixtures=['A','B'].map(name=>({email:env['MWD_LAB_'+name+'_EMAIL'],password:env['MWD_LAB_'+name+'_PASSWORD']}));
 check(env.MWD_CONFIRM_HOSTED_WALLET_PROOF==='YES_AUTHORIZED_SYNTHETIC_ONLY'&&/^sb_publishable_[A-Za-z0-9_-]{16,200}$/.test(key||'')&&
 fixtures.every(f=>typeof f.email==='string'&&f.email.length>0&&typeof f.password==='string'&&f.password.length>0)&&
 fixtures[0].email.toLowerCase()!==fixtures[1].email.toLowerCase()&&typeof exportedAt==='string','LAB_CONFIGURATION_REQUIRED');
 // Validate the expected export locally before any network call.
 buildWalletAcceptanceFixture(exportedAt);
 // No credential-bearing request may leave the fixed LAB origin.
 const boundedFetch=(url,opts={})=>{
  const target=new URL(typeof url==='string'?url:url.url||url.href);
  if(target.origin!==origin||target.username||target.password)throw Error('UNAPPROVED_ORIGIN');
  return fetchImpl(url,{...opts,redirect:'error',signal:opts.signal?AbortSignal.any([opts.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
 };
 const client=createPortfolioClient({environment:'sandbox',sandboxOrigin:origin,transport:'hosted-snapshot',publishableKey:key,fetchImpl:boundedFetch});
 return runProof({exportedAt,fixtures,
  async anonRead(){
   const response=await boundedFetch(origin+'/rest/v1/rpc/mwd_lab_read_wallet_snapshot',{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:'{}'});
   await response.body?.cancel();
   return [401,403,404].includes(response.status);
  },
  async signIn(f){
   const authClient=createAuthClient(origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:boundedFetch}});
   const {data,error}=await authClient.auth.signInWithPassword({email:f.email,password:f.password});
   if(error||!data?.session?.access_token||!data?.user?.id||data.user.is_anonymous!==false){await authClient.auth.signOut({scope:'local'}).catch(()=>{});throw Error('LOGIN_FAILED');}
   return {token:data.session.access_token,userId:data.user.id,anonymous:false,authClient,closed:false};
  },
  read:token=>client.read(token),
  async signOut(s){
   if(s.closed)return;
   const {error}=await s.authClient.auth.signOut({scope:'local'});
   if(error)throw Error('LOGOUT_FAILED');
   s.closed=true;
  }
 });
}
async function main(){
 // Lazy SDK load preserves the credential-free negative check.
 const result=await runHostedProof({env:process.env,createAuthClient:(...args)=>require('@supabase/supabase-js').createClient(...args),fetchImpl:globalThis.fetch});
 console.log(result);
}
module.exports={runProof,runHostedProof};
if(require.main===module)main().catch(e=>{
 const code=String(e?.message||'');
 console.error(/^(LAB_CONFIGURATION_REQUIRED|LOGIN_FAILED|LOGOUT_FAILED|ANONYMOUS_NOT_DENIED|DISTINCT_USERS_REQUIRED|UNRELATED_SESSION_LOST|INVALID_EXPORT_TIME|(?:WALLET_SNAPSHOT_MISMATCH|REVOKED_SESSION_NOT_DENIED)_[01])$/.test(code)?code:'HOSTED_WALLET_PROOF_FAILED');
 process.exitCode=1;
});
