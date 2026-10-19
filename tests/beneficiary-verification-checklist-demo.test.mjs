import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInternationalDemoPlan,DEMO_PAYOUT_METHODS} from '../src/digital-money/international-demo-planner.mjs';
import {buildBeneficiaryVerificationChecklistDemo} from '../src/digital-money/beneficiary-verification-checklist-demo.mjs';
test('requisitos por método no verifican identidad ni habilitan transacciones',()=>{
 for(const method of DEMO_PAYOUT_METHODS){
  const plan=buildInternationalDemoPlan({originCode:'US',destinationCode:'HN',payoutMethod:method.id});
  const result=buildBeneficiaryVerificationChecklistDemo(plan);
  assert.equal(result.canTransfer,false);
  assert.equal(result.beneficiaryVerified,false);
  assert.equal(result.providerVerificationAvailable,false);
  assert.equal(result.capturesPersonalData,false);
  assert.equal(result.checklist.length,7);
  assert.ok(result.checklist.every(x=>x.status==='requires_external_verification'));
 }
});
test('el planificador se niega a confiar en un supuesto corredor activado',()=>{
 const p=buildInternationalDemoPlan();
 for(const patch of [{realPaymentsEnabled:true},{corridorStatus:'enabled'},{providerId:'fake'},{beneficiaryDataCollected:true},{payoutMethod:'invalid'}])
  assert.equal(buildBeneficiaryVerificationChecklistDemo({...p,...patch}),null);
 assert.equal(buildBeneficiaryVerificationChecklistDemo(null),null);
});
