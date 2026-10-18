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

test('búsqueda multilingüe conserva Nicaragua y 249 destinos bloqueados',()=>{
 for(const [word,code] of [['Nicaragua','NI'],['Nicarágua','NI'],['Spain','ES'],['España','ES'],['Espanha','ES'],['Turkey','TR'],['Turquía','TR'],['Mexico','MX'],['México','MX'],['United States','US'],['Estados Unidos','US'],['Germany','DE'],['Alemania','DE']]){
  for(const language of ['es','en','pt']){
   const hit=searchWorldResearchCountries(word,12,language).find(x=>x.code===code);
   assert.ok(hit,word+' '+language);
   assert.equal(hit.realPaymentsEnabled,false);
   assert.equal(hit.licensedRemittanceCorridor,false);
   assert.equal(hit.currency,null);
  }
 }
 assert.equal(getWorldResearchCountry('ES','en').name,'Spain');
 assert.equal(getWorldResearchCountry('ES','pt').name,'Espanha');
 assert.equal(getWorldResearchCountry('NI','en').name,'Nicaragua');
 assert.equal(getWorldResearchCountry('NI','pt').name,'Nicarágua');
 assert.equal(GLOBAL_RESEARCH_COUNTRY_COUNT,249);
});
test('entradas inseguras no activan países y el código ISO exacto tiene prioridad',()=>{
 for(const language of ['es','en','pt','xx',null]){
  const first=searchWorldResearchCountries('NI',12,language)[0];
  assert.equal(first.code,'NI');
  assert.equal(first.realPaymentsEnabled,false);
 }
 for(const query of [null,42,{},'x'.repeat(81)])
  assert.equal(searchWorldResearchCountries(query,12,'en').length,0);
 for(const code of ['NI','HN','JP'])assert.equal(getWorldResearchCountry(code,'en').realPaymentsEnabled,false);
});
