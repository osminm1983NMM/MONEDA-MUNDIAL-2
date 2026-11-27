'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createHostedWalletVerifier:create,createHostedWalletService}=require('../../financial-sandbox/hosted-wallet-auth.cjs');
const origin='https://tfamyuqqpenilnovqjpp.supabase.co',endpoint=origin+'/rest/v1/rpc/mwd_lab_session_identity';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
const key='sb_publishable_synthetic_test_only';
const token=(sub=alice,extra={})=>'e30.'+Buffer.from(JSON.stringify({iss:origin+'/auth/v1',role:'authenticated',is_anonymous:false,sub,...extra})).toString('base64url')+'.test';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const verifier=(fetchImpl,extra={})=>create({environment:'sandbox',publishableKey:key,enrolledActors:[alice],fetchImpl,...extra});
test('uses fixed remote session RPC and verifies matching enrolled identity',async()=>{
 const t=token();const verify=verifier(async(url,init)=>{
  a.equal(url,endpoint);a.equal(init.method,'POST');a.equal(init.redirect,'error');a.equal(init.credentials,'omit');a.equal(init.headers.authorization,'Bearer '+t);a.equal(init.headers.apikey,key);a.equal(init.body,'{}');
  return reply({actor:alice,environment:'sandbox'});
 });
 a.deepEqual(await verify(t),{environment:'sandbox',actor:alice});
});
test('unapproved actors, anonymous, wrong issuer and malformed JWT never reach RPC',async()=>{
 let calls=0;const verify=verifier(async()=>{calls++;return reply(null);});
 for(const t of [token(bob),token(alice,{is_anonymous:true}),token(alice,{iss:'https://other.invalid/auth/v1'}),token(alice,{role:'anon'}),'invalid',undefined])a.equal(await verify(t),null);
 a.equal(calls,0);
});
test('valid-looking token is not sufficient: remote revocation and authorization denial',async()=>{
 for(const status of [200,401,403])a.equal(await verifier(async()=>reply(null,status))(token()),null);
});
test('remote mismatched identity, malformed schema, duplicate fields and transport errors fail closed',async()=>{
 for(const response of [()=>reply({environment:'sandbox',actor:bob}),()=>reply({environment:'sandbox',actor:alice,extra:'secret'}),()=>new Response('{"actor":"'+alice+'","actor":"'+alice+'","environment":"sandbox"}',{headers:{'content-type':'application/json'}}),()=>reply('x'.repeat(513)),()=>reply(null,500)]){
  await a.rejects(verifier(async()=>response())(token()),/IDENTITY_UNAVAILABLE/);
 }
});
test('wallet service requires explicit enablement and audited pricing ledger',()=>{
 const args={environment:'sandbox',enabled:true,publishableKey:key,enrolledActors:[alice],ledger:{reconciliationRequired:()=>true,verifiedPricingRequired:()=>true,reconciliationSnapshot:()=>({})},fetchImpl:async()=>reply(null)};
 a.doesNotThrow(()=>createHostedWalletService(args));
 for(const patch of [{enabled:false},{environment:'production'},{ledger:{reconciliationRequired:()=>true,verifiedPricingRequired:()=>false}}])a.throws(()=>createHostedWalletService({...args,...patch}),/HOSTED_WALLET_DISABLED/);
 a.throws(()=>create({...args,enrolledActors:[alice,alice]}),/INVALID_ENROLLMENT/);
});
