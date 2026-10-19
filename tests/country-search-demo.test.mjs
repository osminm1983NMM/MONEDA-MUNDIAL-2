import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_COUNTRY_CODES} from '../src/digital-money/international-demo-planner.mjs';
import {countryOptionsDemo,searchCountryOptionsDemo} from '../src/digital-money/country-search-demo.mjs';
test('todos los países siguen disponibles y destinos clave tienen etiquetas',()=>{
 assert.equal(countryOptionsDemo.length,249);
 assert.deepEqual(countryOptionsDemo.map(x=>x.code),ALL_COUNTRY_CODES);
 for(const code of ['HN','NI','SV','CR','EC','US','ES','TR']){
  assert.ok(countryOptionsDemo.find(x=>x.code===code && x.name!==code));
 }
});
test('selección normaliza acentos y nunca activa un corredor',()=>{
 assert.equal(searchCountryOptionsDemo('mexico')[0]?.code,'MX');
 assert.equal(searchCountryOptionsDemo('nicaragua')[0]?.code,'NI');
 assert.equal(searchCountryOptionsDemo('HN')[0]?.code,'HN');
 assert.equal(searchCountryOptionsDemo('',12).length,12);
 assert.deepEqual(searchCountryOptionsDemo('zzz'),[]);
 assert.deepEqual(searchCountryOptionsDemo('hn',0),[]);
});

test('nombres internacionalizados o respaldo por código cubren los 249 países',()=>{
 for(const x of countryOptionsDemo){
  assert.equal(typeof x.name,'string');
  assert.ok(x.name.length>=2);
  assert.ok(x.label.includes('('+x.code+')'));
  assert.equal(searchCountryOptionsDemo(x.code,249).some(y=>y.code===x.code),true,x.code);
 }
 assert.equal(searchCountryOptionsDemo('México')[0]?.code,'MX');
});
