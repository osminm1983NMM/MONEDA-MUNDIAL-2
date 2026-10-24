import test from 'node:test';import assert from 'node:assert/strict';
import {getProviderResearchOverview,RESEARCH_PROVIDERS,RESEARCH_PAYOUTS} from '../src/digital-money/provider-research-overview.mjs';
test('ningún proveedor candidato concede acuerdos ni pagos por nombre',()=>{
 for(const destination of ['HN','NI','EC','CR'])
 for(const method of Object.keys(RESEARCH_PAYOUTS)){
  const r=getProviderResearchOverview({destination,method,asOf:'2026-10-17'});
  assert.equal(r.confirmedProviders,0);assert.equal(r.realTransfersEnabled,false);
  assert.equal(r.candidates.length,RESEARCH_PROVIDERS.length);
  assert.ok(r.candidates.every(c=>!c.confirmedRoute&&!c.providerContractSigned&&!c.sandboxAuthorized&&!c.canSend&&c.documentationMissing===c.documentationRequired));
 }
});
test('un método no prioritario no significa rechazo regulatorio',()=>{
 const r=getProviderResearchOverview({destination:'HN',method:'cash_pickup'});
 assert.equal(r.candidates[0].name,'MoneyGram');
 assert.equal(r.candidates.find(x=>x.name==='MoneyGram').candidateMethodInResearch,true);
 assert.equal(r.candidates.find(x=>x.name==='Thunes').candidateMethodInResearch,true);
 assert.equal(r.candidates.find(x=>x.name==='Nium').candidateMethodInResearch,false);
 assert.equal(r.candidates.find(x=>x.name==='Nium').confirmedRoute,false);
});
test('MoneyGram se investiga por cuenta y efectivo sin afirmar soporte US-HN',()=>{
 for(const method of ['bank_account','cash_pickup']){
  const candidate=getProviderResearchOverview({destination:'HN',method})
   .candidates.find(x=>x.name==='MoneyGram');
  assert.equal(candidate.candidateMethodInResearch,true);
  assert.equal(candidate.confirmedRoute,false);
  assert.equal(candidate.providerContractSigned,false);
  assert.equal(candidate.sandboxAuthorized,false);
  assert.equal(candidate.canSend,false);
 }
});
test('entradas inválidas no muestran autorización',()=>{
 assert.equal(getProviderResearchOverview({destination:'ZZ'}),null);
 assert.equal(getProviderResearchOverview({method:'crypto_real'}),null);
});
