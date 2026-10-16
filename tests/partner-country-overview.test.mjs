import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCountryReadinessOverview} from '../src/partner-country-overview.mjs';
test('Agrupa candidatos por país sin habilitar dinero real',()=>{
 const partners=[
  {id:'a',country_code:'NI',review_status:'under_review'},
  {id:'b',country_code:'NI',review_status:'documented'},
  {id:'c',country_code:'CR',review_status:'draft'},
  {id:'d',country_code:'HN',review_status:'archived'},
 ];
 const expiry=[
  {partner_id:'a',alert_level:'expired'},
  {partner_id:'b',alert_level:'missing_date'},
  {partner_id:'c',alert_level:'due_soon'},
  {partner_id:'d',alert_level:'expired'}
 ];
 const rows=buildCountryReadinessOverview(partners,expiry);
 assert.equal(rows.length,2);
 assert.equal(rows[0].countryCode,'CR');
 assert.equal(rows[0].dueSoon,1);
 assert.equal(rows[1].countryCode,'NI');
 assert.equal(rows[1].candidates,2);
 assert.equal(rows[1].expired,1);
 assert.equal(rows[1].missingDates,1);
 assert.equal(rows[1].realPaymentsEnabled,false);
 assert.equal(rows[1].documentsReviewed,1);
});
test('Los candidatos archivados no se consideran disponibles',()=>{
 assert.deepEqual(buildCountryReadinessOverview([{id:'x',country_code:'US',review_status:'archived'}],[]),[]);
});
