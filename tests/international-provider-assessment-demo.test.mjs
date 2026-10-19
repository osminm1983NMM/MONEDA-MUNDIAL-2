import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInternationalDemoPlan} from '../src/digital-money/international-demo-planner.mjs';
import {assessInternationalProviderCandidateDemo,PROVIDER_DUE_DILIGENCE_DEMO} from '../src/digital-money/international-provider-assessment-demo.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
test('documentación revisada no equivale a autorización para transferir',()=>{
 const plan=buildInternationalDemoPlan();
 const candidate={id,partner_kind:'remittance_company',review_status:'documented',country_code:'HN'};
 const assessment=assessInternationalProviderCandidateDemo(plan,candidate);
 assert.equal(assessment.documentationReviewed,true);
 assert.equal(assessment.legalAuthorizationVerified,false);
 assert.equal(assessment.providerConnected,false);
 assert.equal(assessment.canGetLiveQuote,false);
 assert.equal(assessment.canCreateTransfer,false);
 assert.equal(assessment.realPaymentsEnabled,false);
 assert.equal(assessment.canCollectBeneficiaryData,false);
 assert.equal(assessment.missing.length,PROVIDER_DUE_DILIGENCE_DEMO.length);
 assert.ok(assessment.missing.every(x=>x.status==='unverified'));
});
test('proveedor no elegido y Nicaragua siguen como planificación',()=>{
 const p=buildInternationalDemoPlan({originCode:'US',destinationCode:'NI'});
 const result=assessInternationalProviderCandidateDemo(p);
 assert.equal(result.candidateId,null);
 assert.equal(result.canCreateTransfer,false);
});
test('no acepta candidato extranjero a la ruta ni plan indebidamente activo',()=>{
 const p=buildInternationalDemoPlan();
 const c={id,partner_kind:'bank',review_status:'draft',country_code:'HN'};
 assert.equal(assessInternationalProviderCandidateDemo({...p,executionAvailable:true},c),null);
 assert.equal(assessInternationalProviderCandidateDemo(p,{...c,country_code:'XX'}),null);
 assert.equal(assessInternationalProviderCandidateDemo(p,{...c,review_status:'licensed'}),null);
 assert.equal(assessInternationalProviderCandidateDemo(p,{...c,id:'invalid'}),null);
});
