import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRegisteredPickupCandidates, projectRegisteredPickupDesign } from '../src/registered-pickup-design.mjs';

test('catálogo distingue borradores de socios archivados sin activar retiros',()=>{
 const rows=[
  {id:'1',country_code:'NI',review_status:'draft'},
  {id:'2',country_code:'NI',review_status:'documented'},
  {id:'3',country_code:'CR',review_status:'under_review'},
  {id:'4',country_code:'HN',review_status:'archived'}
 ];
 assert.deepEqual(summarizeRegisteredPickupCandidates(rows),{
  activeCandidateCount:3,archivedCandidateCount:1,countriesWithCandidates:2,
  countriesWithAuthorizedPayouts:0,authorizedPartners:0,
  authorizedBranches:0,realPaymentsEnabled:false,
 });
});

test('documentación revisada nunca autoriza pago, ni permite generar código cobrable',()=>{
 const p={id:'partner-1',country_code:'NI',review_status:'documented'};
 const projection=projectRegisteredPickupDesign(p,[
  {id:'1',currency_code:'NIO',review_status:'draft'},
  {id:'2',currency_code:'USD',review_status:'draft'},
  {id:'3',currency_code:'NIO',review_status:'draft'},
 ]);
 assert.equal(projection.destinationCountry,'NI');
 assert.deepEqual(projection.suggestedCurrencies,['NIO','USD']);
 assert.equal(projection.branchDraftCount,3);
 assert.equal(projection.canPreviewFictionalScenario,true);
 assert.equal(projection.realPaymentsEnabled,false);
 assert.equal(projection.redeemableCodeAvailable,false);
 assert.equal(projection.cashDisbursementAvailable,false);
 assert.equal(projectRegisteredPickupDesign({...p,review_status:'archived'},[]).canPreviewFictionalScenario,false);
});
test('rechaza registros inválidos y campos que aparentan autorizar cobro',()=>{
 assert.equal(projectRegisteredPickupDesign({id:'1',country_code:'NIC',review_status:'draft'}),null);
 const p={id:'1',country_code:'US',review_status:'draft',realPaymentsEnabled:true,partnerAuthorized:true};
 const x=projectRegisteredPickupDesign(p,[{id:'l',currency_code:'USD',review_status:'draft',canPayoutCash:true}]);
 assert.equal(x.realPaymentsEnabled,false);
 assert.equal(x.cashPickupAgentAuthorized,false);
 assert.equal(x.redeemableCodeAvailable,false);
});
