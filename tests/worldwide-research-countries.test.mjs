import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBAL_RESEARCH_COUNTRY_COUNT,WORLD_RESEARCH_REAL_PAYMENTS_ENABLED,
 getWorldResearchCountry,searchWorldResearchCountries}
 from '../src/digital-money/worldwide-research-countries.mjs';
test('catálogo mundial conserva Nicaragua, Honduras y destinos generales',()=>{
 assert.equal(GLOBAL_RESEARCH_COUNTRY_COUNT,249);
 assert.equal(WORLD_RESEARCH_REAL_PAYMENTS_ENABLED,false);
 for(const code of ['HN','NI','EC','CR','MX','ES','TR','US','JP','ZA']){
  const c=getWorldResearchCountry(code);
  assert.equal(c.code,code);
  assert.equal(c.currency,null);
  assert.equal(c.bankProviderConfirmed,false);
  assert.equal(c.realPaymentsEnabled,false);
  assert.ok(c.name.length>0);
 }
});
test('buscador acotado por código o por nombre sin habilitar operaciones',()=>{
 assert.equal(searchWorldResearchCountries('NI').some(x=>x.code==='NI'),true);
 assert.equal(searchWorldResearchCountries('Honduras').some(x=>x.code==='HN'),true);
 assert.equal(searchWorldResearchCountries('mexico').some(x=>x.code==='MX'),true);
 assert.equal(searchWorldResearchCountries('TR').some(x=>x.code==='TR'),true);
 assert.deepEqual(searchWorldResearchCountries('').map(x=>x.code),['HN','NI','EC','CR']);
 for(const code of ['ZZ','ZZZ','ni','__proto__',null])assert.equal(getWorldResearchCountry(code),null);
 assert.equal(searchWorldResearchCountries('NI',0).length,0);
 assert.equal(searchWorldResearchCountries('NI',26).length,0);
 assert.equal(searchWorldResearchCountries('x'.repeat(81)).length,0);
 assert.ok(searchWorldResearchCountries('a').every(x=>!x.realPaymentsEnabled));
});
