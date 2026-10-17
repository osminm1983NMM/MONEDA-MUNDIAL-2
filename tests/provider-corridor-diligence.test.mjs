import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderCorridorDiligence,PROVIDER_CORRIDOR_EVIDENCE,PROVIDER_PAYOUT_EVIDENCE}
 from '../src/server/provider-corridor-diligence.mjs';

const asOf='2026-10-17';
const candidateProviderId='PROVIDER-DEMO-0001';
const REGULATOR=new Set([
 'origin_licensing_model_and_state_scope',
 'destination_licensing_and_partner_scope',
 'licensed_cash_pickup_agent_network',
]);
const SIGNED=new Set([
 'signed_regulated_provider_agreement',
 'funds_safeguarding_and_settlement_responsibility',
 'kyc_aml_sanctions_responsibility_matrix',
]);
const sourceFor=key=>REGULATOR.has(key)?'regulator_record':
 SIGNED.has(key)?'signed_contract':'provider_documentation';
const corridor={origin:'US',destination:'HN',sourceCurrency:'USD',
 destinationCurrency:'HNL',payoutMethod:'cash_pickup'};
const makeEvidence=(route=corridor,providerId=candidateProviderId)=>{
 const scope=[providerId,route.origin,route.destination,route.sourceCurrency,
  route.destinationCurrency,route.payoutMethod].join(':');
 return Object.fromEntries([...PROVIDER_CORRIDOR_EVIDENCE,
  ...PROVIDER_PAYOUT_EVIDENCE[route.payoutMethod]]
  .map((key,i)=>[key,{scope,reference:'DOC-TEST-'+String(i).padStart(3,'0'),
   source:sourceFor(key),reviewedOn:'2026-10-01',
   expiresOn:'2026-12-31'}]));
};

test('sin expediente no existe ruta financiera habilitada',()=>{
 const v=assessProviderCorridorDiligence({candidateProviderId,corridor,asOf});
 assert.equal(v.corridorValid,true);
 assert.equal(v.missingOrInvalidRequirements.length,v.requirementsCount);
 assert.equal(v.realPaymentsEnabled,false);
 assert.equal(v.canMoveMoney,false);
 assert.equal(v.canRedeemPickupCode,false);
});
test('expediente documental completo NO certifica proveedor, licencia ni liquidación',()=>{
 const v=assessProviderCorridorDiligence({candidateProviderId,corridor,evidence:makeEvidence(),asOf});
 assert.equal(v.documentCollectionComplete,true);
 assert.equal(v.status,'awaiting_independent_legal_and_provider_verification');
 for(const key of ['destinationCoverageAuthorized','partnerContractVerified',
  'legalLaunchApproval','officialSandboxConnected','payoutNetworkConnected',
  'realPaymentsEnabled','canQuoteRealFx','canHoldCustomerFunds',
  'canMoveMoney','canRedeemPickupCode']){
  assert.equal(v[key],false,key);
 }
 assert.equal(JSON.stringify(v).includes('DOC-TEST-'),false);
});
test('referencias de Honduras no sirven para Nicaragua ni otro método de pago',()=>{
 const evidence=makeEvidence();
 for(const target of [{...corridor,destination:'NI'},
  {...corridor,payoutMethod:'bank_account'}]){
  const v=assessProviderCorridorDiligence({candidateProviderId,corridor:target,evidence,asOf});
  assert.equal(v.documentCollectionComplete,false);
  assert.ok(v.missingOrInvalidRequirements.length>0);
  assert.equal(v.canMoveMoney,false);
 }
});
test('la caducidad y fechas no reales bloquean expediente',()=>{
 const expired=makeEvidence();
 expired.provider_legal_identity.expiresOn='2026-10-16';
 assert.equal(assessProviderCorridorDiligence({candidateProviderId,corridor,evidence:expired,asOf})
  .missingOrInvalidRequirements.includes('provider_legal_identity'),true);
 expired.provider_legal_identity.expiresOn='2026-02-30';
 assert.equal(assessProviderCorridorDiligence({candidateProviderId,corridor,evidence:expired,asOf})
  .documentCollectionComplete,false);
});
test('rechaza registros extraños y autoafirmaciones de autorización',()=>{
 const evidence=makeEvidence();
 evidence.provider_legal_identity.liveApproved=true;
 const v=assessProviderCorridorDiligence({candidateProviderId,corridor,evidence,asOf});
 assert.equal(v.documentCollectionComplete,false);
 assert.ok(v.missingOrInvalidRequirements.includes('provider_legal_identity'));
 assert.equal(v.realPaymentsEnabled,false);
});
test('se aceptan países del catálogo global solo como candidatos documentales',()=>{
 const ec={...corridor,destination:'EC',destinationCurrency:'USD'};
 const v=assessProviderCorridorDiligence({candidateProviderId,corridor:ec,evidence:makeEvidence(ec),asOf});
 assert.equal(v.corridorValid,true);
 assert.equal(v.documentCollectionComplete,true);
 assert.equal(v.destinationCoverageAuthorized,false);
});
test('monedas inválidas, mismo país, fecha ausente y método no reconocido fallan cerrados',()=>{
 for(const route of [{...corridor,sourceCurrency:'usd'},
  {...corridor,origin:'HN'}, {...corridor,payoutMethod:'crypto'},
  {...corridor,destination:'HND'}, {...corridor,providerToken:'NO'}]){
  const v=assessProviderCorridorDiligence({candidateProviderId,corridor:route,asOf,evidence:makeEvidence()});
  assert.equal(v.status,'invalid_input');
  assert.equal(v.realPaymentsEnabled,false);
 }
 assert.equal(assessProviderCorridorDiligence({candidateProviderId,corridor,evidence:makeEvidence()}).dateValid,false);
});

test('evidencia de otro proveedor no se acepta aunque coincidan país y método',()=>{
 const copy=assessProviderCorridorDiligence({
  candidateProviderId:'PROVIDER-DEMO-9999',corridor,asOf,evidence:makeEvidence()
 });
 assert.equal(copy.corridorValid,true);
 assert.equal(copy.documentsCurrentCount,0);
 assert.equal(copy.documentCollectionComplete,false);
 assert.equal(copy.canMoveMoney,false);
});

test('identificador de proveedor obligatorio, opaco y validado',()=>{
 for(const invalid of [undefined,'', 'a', 'correo@ejemplo.com', 'a'.repeat(81)]){
  const v=assessProviderCorridorDiligence({
   candidateProviderId:invalid,corridor,asOf,evidence:makeEvidence()
  });
  assert.equal(v.status,'invalid_input');
  assert.equal(v.realPaymentsEnabled,false);
 }
});

test('licencias, contratos y red de retiro exigen fuente documental correcta',()=>{
 for(const [key,incorrectSource] of [
  ['origin_licensing_model_and_state_scope','internal_policy'],
  ['destination_licensing_and_partner_scope','provider_documentation'],
  ['licensed_cash_pickup_agent_network','signed_contract'],
  ['signed_regulated_provider_agreement','regulator_record'],
  ['funds_safeguarding_and_settlement_responsibility','internal_policy'],
  ['kyc_aml_sanctions_responsibility_matrix','provider_documentation'],
  ['sandbox_access_and_authorized_api_spec','internal_policy'],
 ]){
  const evidence=makeEvidence();
  evidence[key].source=incorrectSource;
  const v=assessProviderCorridorDiligence({candidateProviderId,corridor,asOf,evidence});
  assert.equal(v.documentCollectionComplete,false,key);
  assert.ok(v.missingOrInvalidRequirements.includes(key),key);
  assert.equal(v.canMoveMoney,false,key);
 }
});

test('documentos válidos por forma no certifican una institución ni habilitan activos',()=>{
 const v=assessProviderCorridorDiligence({
  candidateProviderId,corridor,asOf,evidence:makeEvidence()
 });
 assert.equal(v.documentsCurrentCount,v.requirementsCount);
 assert.equal(v.documentCollectionComplete,true);
 for(const key of ['realPaymentsEnabled','canHoldCustomerFunds','canMoveMoney',
  'canQuoteRealFx','canRedeemPickupCode','partnerContractVerified']){
  assert.equal(v[key],false,key);
 }
});
