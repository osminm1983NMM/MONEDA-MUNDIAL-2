import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPartnerReadinessMatrix} from '../src/partner-readiness-matrix.mjs';

const row=(id,values={})=>({
 partner_id:id,partner_name:'Entidad ficticia '+id,country_code:'NI',partner_kind:'bank',
 partner_status:'under_review',branch_drafts:2,requirement_count:10,
 pending_requirements:6,internally_reviewed:4,expired_requirements:1,
 due_30_requirements:2,missing_critical_dates:2,...values,
});
test('matriz muestra vencimientos y faltantes sin habilitar dinero real',()=>{
 const r=buildPartnerReadinessMatrix([row('a'),row('b',{country_code:'HN',expired_requirements:0,
   missing_critical_dates:0,pending_requirements:0,internally_reviewed:10,
   due_30_requirements:0,real_payments_enabled:true})]);
 assert.equal(r.candidates,2);
 assert.equal(r.countries,2);
 assert.equal(r.expiredCandidates,1);
 assert.equal(r.internallyReviewedCandidates,1);
 assert.equal(r.records[0].attention,'critical');
 assert.equal(r.records[1].attention,'external');
 assert.equal(r.records[1].authorized,false);
 assert.equal(r.records[1].canPayout,false);
 assert.equal(r.canPayoutCash,false);
 assert.equal(r.realPaymentsEnabled,false);
 assert.equal(r.authorizedPartners,0);
});
test('rechaza contadores contradictorios y registros archivados o corruptos',()=>{
 const r=buildPartnerReadinessMatrix([
   row('a',{internally_reviewed:12}),
   row('b',{expired_requirements:-1}),
   row('c',{pending_requirements:NaN}),
   row('d',{partner_status:'archived'}),
   row('e',{country_code:'NIC'}),
   row('f',{missing_critical_dates:4}),
   row('g',{requirement_count:0}),
   row('h',{partner_name:' '}),
   row('i',{pending_requirements:0,internally_reviewed:10,expired_requirements:0,
     due_30_requirements:0,missing_critical_dates:0})
 ]);
 assert.equal(r.candidates,1);
 assert.equal(r.records[0].id,'i');
 assert.equal(r.records[0].attention,'external');
});
test('se tolera una RPC vacía sin inventar candidatos ni sucursales',()=>{
 for(const input of [null,undefined,[],{}]){
  const r=buildPartnerReadinessMatrix(input);
  assert.equal(r.candidates,0);
  assert.equal(r.authorizedBranches,0);
  assert.deepEqual(r.records,[]);
 }
});
