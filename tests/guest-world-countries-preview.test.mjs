import test from 'node:test';
import assert from 'node:assert/strict';
import {getGuestWorldCountryPreview,GUEST_WORLD_COUNTRIES_REAL_PAYMENTS_ENABLED}
 from '../src/guest-world-countries-preview.mjs';
test('249 destinos investigables sin cuenta ni fondos reales',()=>{
 assert.equal(GUEST_WORLD_COUNTRIES_REAL_PAYMENTS_ENABLED,false);
 for(const language of ['es','en','pt',null]){
  const v=getGuestWorldCountryPreview({language});
  assert.equal(v.totalCount,249);
  assert.equal(v.liveCountries,0);
  assert.equal(v.requiresLogin,false);
  assert.equal(v.offlineOnly,true);
  assert.equal(v.realPaymentsEnabled,false);
  assert.ok(v.results.some(x=>x.code==='HN'));
  assert.ok(v.results.some(x=>x.code==='NI'));
  assert.ok(v.results.every(x=>x.realPaymentsEnabled===false));
 }
});
test('búsqueda multilingüe y resultados seguros',()=>{
 for(const [language,query,code] of [['es','Nicaragua','NI'],['en','Spain','ES'],['es','México','MX'],['en','Germany','DE'],['en','NI','NI']]){
  const v=getGuestWorldCountryPreview({language,query});
  assert.ok(v.results.some(x=>x.code===code));
  assert.equal(v.canSend,false);
  assert.equal(v.canDeposit,false);
  assert.equal(v.canWithdraw,false);
  assert.equal(v.providerConnected,false);
 }
 for(const query of [null,{},42,'x'.repeat(81)]){
  const v=getGuestWorldCountryPreview({query});
  assert.equal(v.queryValid,false);
  assert.equal(v.results.length,0);
 }
 const s=JSON.stringify(getGuestWorldCountryPreview({query:'HN'}));
 assert.doesNotMatch(s,/service_role|sb_secret_|privateKey|https:\/\//);
});
