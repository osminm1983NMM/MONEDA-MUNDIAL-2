'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {runProof}=require('../../scripts/verify-hosted-wallet-proof.cjs');
const {buildWalletAcceptanceFixture}=require('../../financial-sandbox/wallet-acceptance-fixture.cjs');
const exportedAt='2026-11-27T12:00:00.000Z',x=buildWalletAcceptanceFixture(exportedAt);
function mock(o={}){
 const revoked=new Set(),cleaned=[];
 return {exportedAt,fixtures:['A','B'],cleaned,
 anonRead:async()=>!o.anon,
 signIn:async f=>({token:f,userId:o.same?'A':f,anonymous:false}),
 signOut:async s=>{cleaned.push(s.token);if(o.logout)throw Error('LOGOUT_FAILED');revoked.add(s.token);if(o.globalLogout)revoked.add('B');},
 read:async t=>{
  if(revoked.has(t)&&!o.revocation)return {ok:false,code:o.unavailable?'UNAVAILABLE':'AUTH_REQUIRED'};
  const i=t==='A'||o.leak?0:1;
  const value=structuredClone(x.portfolios[i].portfolio);
  if(o.amount)value.assets[0].availableMinor='999';
  return {ok:true,value,snapshot:{kind:x.kind,exportedAt:o.stale?'2026-11-26T12:00:00.000Z':exportedAt}};
 }};
}
test('hosted wallet proof requires exact distinct snapshots and denial after both signouts',async()=>{
 const m=mock();a.match(await runProof(m),/^PASS:/);a.ok(m.cleaned.includes('A')&&m.cleaned.includes('B'));
});
for(const [name,options,code] of [
 ['anonymous access',{anon:true},'ANONYMOUS_NOT_DENIED'],
 ['same identity',{same:true},'DISTINCT_USERS_REQUIRED'],
 ['cross account projection',{leak:true},'WALLET_SNAPSHOT_MISMATCH_1'],
 ['wrong amount',{amount:true},'WALLET_SNAPSHOT_MISMATCH_0'],
 ['stale timestamp',{stale:true},'WALLET_SNAPSHOT_MISMATCH_0'],
 ['accepted revoked token',{revocation:true},'REVOKED_SESSION_NOT_DENIED_0'],
 ['network failure not proof of revocation',{unavailable:true},'REVOKED_SESSION_NOT_DENIED_0'],
 ['shared session invalidation',{globalLogout:true},'UNRELATED_SESSION_LOST'],
 ['logout failure',{logout:true},'LOGOUT_FAILED']
])test('rejects '+name,async()=>{
 const m=mock(options);await a.rejects(runProof(m),new RegExp(code));
 if(!options.anon)a.ok(m.cleaned.includes('A')&&m.cleaned.includes('B'));
});

test('partial login failure still closes the first acquired session',async()=>{
 const m=mock(),original=m.signIn;
 m.signIn=async f=>{if(f==='B')throw Error('LOGIN_FAILED');return original(f);};
 await a.rejects(runProof(m),/LOGIN_FAILED/);a.deepEqual(m.cleaned,['A']);
});
test('a revoked first session cannot regain access after the second logout',async()=>{
 const m=mock(),original=m.read;let aDenied=false;
 m.read=async token=>{
  const r=await original(token);
  if(token==='A'&&!r.ok){
   if(aDenied)return {ok:true,value:x.portfolios[0].portfolio,snapshot:{kind:x.kind,exportedAt}};
   aDenied=true;
  }
  return r;
 };
 await a.rejects(runProof(m),/REVOKED_SESSION_NOT_DENIED_0/);
});

test('complete manual runner uses real portfolio client with injected offline HTTP and Auth',async()=>{
 const {runHostedProof}=require('../../scripts/verify-hosted-wallet-proof.cjs');
 const origin='https://tfamyuqqpenilnovqjpp.supabase.co',key='sb_publishable_synthetic_test_only';
 const env={MWD_CONFIRM_HOSTED_WALLET_PROOF:'YES_AUTHORIZED_SYNTHETIC_ONLY',MWD_LAB_PUBLISHABLE_KEY:key,MWD_LAB_WALLET_EXPORTED_AT:exportedAt,MWD_LAB_A_EMAIL:'a@example.invalid',MWD_LAB_B_EMAIL:'b@example.invalid',MWD_LAB_A_PASSWORD:'fake-a',MWD_LAB_B_PASSWORD:'fake-b'};
 const tokens=['A','B'].map(sub=>'e30.'+Buffer.from(JSON.stringify({iss:origin+'/auth/v1',role:'authenticated',is_anonymous:false,sub})).toString('base64url')+'.test');
 const active=new Set(),calls=[];
 const createAuthClient=(url,k,opts)=>{
  a.equal(url,origin);a.equal(k,key);a.equal(opts.auth.persistSession,false);a.equal(opts.auth.autoRefreshToken,false);
  let token;
  return {auth:{async signInWithPassword(f){
   const i=f.email===env.MWD_LAB_A_EMAIL?0:1;token=tokens[i];active.add(token);
   return {data:{session:{access_token:token},user:{id:String(i),is_anonymous:false}},error:null};
  },async signOut(o){a.equal(o.scope,'local');active.delete(token);return {error:null};}}};
 };
 const fetchImpl=async(url,opts)=>{
  a.equal(url,origin+'/rest/v1/rpc/mwd_lab_read_wallet_snapshot');a.equal(opts.method,'POST');a.equal(opts.body,'{}');a.equal(opts.redirect,'error');a.ok(opts.signal);
  a.equal(opts.headers.apikey,key);
  const token=opts.headers.authorization?.slice(7),i=tokens.indexOf(token);calls.push(i);
  if(i<0)return new Response(null,{status:401});
  return new Response(JSON.stringify(active.has(token)?{kind:x.kind,exportedAt,portfolio:x.portfolios[i].portfolio}:null,null,2),{headers:{'content-type':'application/json'}});
 };
 a.match(await runHostedProof({env,createAuthClient,fetchImpl}),/^PASS:/);
 a.deepEqual(calls,[-1,0,1,0,1,1,0]);a.equal(active.size,0);
 let externalCalls=0;
 const foreignAuth=(url,k,opts)=>({auth:{async signInWithPassword(){await opts.global.fetch('https://elsewhere.invalid/auth/v1/token');}}});
 await a.rejects(runHostedProof({env,createAuthClient:foreignAuth,fetchImpl:async(url,opts)=>{if(!url.startsWith(origin+'/'))externalCalls++;return fetchImpl(url,opts);}}),/UNAPPROVED_ORIGIN/);
 a.equal(externalCalls,0);
});
