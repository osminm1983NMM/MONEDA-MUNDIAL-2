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
 signOut:async s=>{cleaned.push(s.token);if(o.logout)throw Error('LOGOUT_FAILED');revoked.add(s.token);},
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
 ['logout failure',{logout:true},'LOGOUT_FAILED']
])test('rejects '+name,async()=>{
 const m=mock(options);await a.rejects(runProof(m),new RegExp(code));
 if(!options.anon)a.ok(m.cleaned.includes('A')&&m.cleaned.includes('B'));
});
