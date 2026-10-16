import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPartnerPriorityQueue,PRODUCTION_GATES} from '../src/partner-priorities.mjs';
test('vencimientos, tareas pendientes y bloqueos legales permanecen visibles',()=>{
 const candidates=[
  {id:'p1',country_code:'NI',legal_name:'Entidad de prueba',review_status:'draft'},
  {id:'p2',country_code:'CR',legal_name:'Archivo demo',review_status:'archived'}
 ];
 const report=buildPartnerPriorityQueue({partners:candidates,
 expiryRows:[{partner_id:'p1',requirement_type:'regulatory_license',alert_level:'expired',valid_until:'2026-10-01'},
 {partner_id:'p1',requirement_type:'signed_agreement',alert_level:'missing_date',valid_until:null},
 {partner_id:'p2',requirement_type:'regulatory_license',alert_level:'expired',valid_until:'2026-10-01'}],
 activities:[{id:'a1',partner_id:'p1',title:'Revisar propuesta',due_on:'2026-10-20',activity_status:'planned'},
 {id:'a2',partner_id:'p1',title:'Cerrada',due_on:'2026-10-20',activity_status:'completed'}],activitiesAvailable:true});
 assert.equal(report.candidateCount,1);
 assert.equal(report.urgentCount,1);
 assert.equal(report.priorities[0].key,'document:p1:regulatory_license');
 assert.ok(report.priorities.some(x=>x.key==='activity:a1'));
 assert.ok(!report.priorities.some(x=>x.key==='activity:a2'));
 assert.ok(report.priorities.every(x=>x.countryCode!=='CR'));
 assert.equal(report.realPaymentsEnabled,false);
 assert.equal(report.approvedBanks,0);
});
test('si agenda no existe aún, no inventa compromisos',()=>{
 const x=buildPartnerPriorityQueue({activities:[{id:'z',activity_status:'planned',due_on:'2026-10-20'}]});
 assert.equal(x.activitiesAvailable,false);
 assert.deepEqual(x.priorities,[]);
 assert.ok(PRODUCTION_GATES.every(g=>g.status==='not_verified'));
});
