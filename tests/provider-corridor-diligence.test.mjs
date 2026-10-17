import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderCorridorDiligence,PROVIDER_CORRIDOR_EVIDENCE,PROVIDER_PAYOUT_EVIDENCE}
 from '../src/server/provider-corridor-diligence.mjs';

const asOf='2026-10-17';
const corridor={origin:'US',destination:'HN',sourceCurrency:'USD',
 destinationCurrency:'HNL',payoutMethod:'cash_pickup'};
const makeEvidence=(route=corridor,date=asOf)=>{
 const scope=[route.origin,route.destination,route.sourceCurrency,
  route.destinationCurrency,route.payoutMethod].join(':');
 return Object.fromEntries([...PROVIDER_CORRIDOR_EVIDENCE,
  ...PROVIDER_PAYOUT_EVIDENCE[route.payoutMethod]]
  .map((key,i)=>[key,{scope,reference:'DOC-TEST-'+String(i).padStart(3,'0'),
   source:'provider_documentation',reviewedOn:'2026-10-01',
   expiresOn:'2026-12-31'}]));
};

test('sin expediente no existe ruta financiera habilitada',()=>{
 const v=assessProviderCorridorDiligence({corridor,asOf});
 assert.equal(v.corridorValid,true);
 assert.equal(v.missingOrInvalidRequirements.length,v.requirementsCount);
 assert.equal(v.realPaymentsEnabled,false);
 assert.equal(v.canMoveMoney,false);
 assert.equal(v.canRedeemPickupCode,false);
});
test('expediente documental completo NO certifica proveedor, licencia ni liquidación',()=>{
 const v=assessProviderCorridorDiligence({corridor,evidence:makeEvidence(),asOf});
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
  const v=assessProviderCorridorDiligence({corridor:target,evidence,asOf});
  assert.equal(v.documentCollectionComplete,false);
  assert.ok(v.missingOrInvalidRequirements.length>0);
  assert.equal(v.canMoveMoney,false);
 }
});
test('la caducidad y fechas no reales bloquean expediente',()=>{
 const expired=makeEvidence();
 expired.provider_legal_identity.expiresOn='2026-10-16';
 assert.equal(assessProviderCorridorDiligence({corridor,evidence:expired,asOf})
  .missingOrInvalidRequirements.includes('provider_legal_identity'),true);
 expired.provider_legal_identity.expiresOn='2026-02-30';
 assert.equal(assessProviderCorridorDiligence({corridor,evidence:expired,asOf})
  .documentCollectionComplete,false);
});
test('rechaza registros extraños y autoafirmaciones de autorización',()=>{
 const evidence=makeEvidence();
 evidence.provider_legal_identity.liveApproved=true;
 const v=assessProviderCorridorDiligence({corridor,evidence,asOf});
 assert.equal(v.documentCollectionComplete,false);
 assert.ok(v.missingOrInvalidRequirements.includes('provider_legal_identity'));
 assert.equal(v.realPaymentsEnabled,false);
});
test('se aceptan países del catálogo global solo como candidatos documentales',()=>{
 const ec={...corridor,destination:'EC',destinationCurrency:'USD'};
 const v=assessProviderCorridorDiligence({corridor:ec,evidence:makeEvidence(ec),asOf});
 assert.equal(v.corridorValid,true);
 assert.equal(v.documentCollectionComplete,true);
 assert.equal(v.destinationCoverageAuthorized,false);
});
test('monedas inválidas, mismo país, fecha ausente y método no reconocido fallan cerrados',()=>{
 for(const route of [{...corridor,sourceCurrency:'usd'},
  {...corridor,origin:'HN'}, {...corridor,payoutMethod:'crypto'},
  {...corridor,destination:'HND'}, {...corridor,providerToken:'NO'}]){
  const v=assessProviderCorridorDiligence({corridor:route,asOf,evidence:makeEvidence()});
  assert.equal(v.status,'invalid_input');
  assert.equal(v.realPaymentsEnabled,false);
 }
 assert.equal(assessProviderCorridorDiligence({corridor,evidence:makeEvidence()}).dateValid,false);
});
