import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PAYOUT_NETWORK, assessCashPickupReadiness, summarizeCashPickupNetwork } from '../src/payout-network-demo.mjs';
import { evaluateCashPickupReadiness } from '../src/cash-pickup-network.mjs';

test('catálogo mundial no equivale a disponibilidad de agentes',()=>{
 const summary=summarizeCashPickupNetwork([{code:'US'},{code:'NI'},{code:'JP'},{code:'!!'}],EMPTY_PAYOUT_NETWORK);
 assert.equal(summary.designDestinations,3);
 assert.equal(summary.liveCountries,0);
 assert.equal(summary.livePartners,0);
 assert.equal(summary.realPaymentsEnabled,false);
});
test('la red está cerrada si falta un banco, licencia, contrato o sucursal',()=>{
 const result=assessCashPickupReadiness({sourceCountry:'US',destinationCountry:'NI',payoutCurrency:'NIO'});
 assert.equal(result.status,'not_ready');
 assert.equal(result.realPaymentsEnabled,false);
 assert.equal(result.canPayoutCash,false);
 assert.ok(result.missingRequirements.length>0);
});
test('incluso comprobaciones completas exigen aprobación externa: nunca activar pagos locales',()=>{
 const partner={id:'partner-test',dueDiligenceStatus:'verified',contractStatus:'signed',
 originAuthorizationStatus:'verified',destinationAuthorizationStatus:'verified'};
 const branch={partnerId:'partner-test',country:'NI',verificationStatus:'verified',
 operationalStatus:'ready',supportedCurrencies:['NIO']};
 const corridor={partnerId:'partner-test',sourceCountry:'US',destinationCountry:'NI',
 payoutCurrency:'NIO',complianceStatus:'verified',settlementStatus:'verified',
 financialCrimeControlsStatus:'verified'};
 const r=assessCashPickupReadiness({
 sourceCountry:'US',destinationCountry:'NI',payoutCurrency:'NIO',partner,branch,corridor});
 assert.equal(r.status,'candidate_for_external_review');
 assert.deepEqual(r.missingRequirements,[]);
 assert.equal(r.realPaymentsEnabled,false);
 assert.equal(r.canPayoutCash,false);
 assert.equal(r.canIssueRealReference,false);
});
test('otro verificador de seguridad no emite referencias reales ni siquiera con registros aprobados',()=>{
 const input={originCountry:'US',destinationCountry:'NI',currency:'NIO',
 corridor:{originCountry:'US',destinationCountry:'NI',currency:'NIO',status:'approved'},
 partner:{id:'test',status:'approved',verifiedContract:true,licenseVerified:true},
 agent:{id:'agent',partnerId:'test',status:'approved',countryCode:'NI',currencies:['NIO']},
 compliance:{kycPassed:true,sanctionsPassed:true,fundsConfirmed:true,payoutPermissionVerified:true}};
 const result=evaluateCashPickupReadiness(input);
 assert.equal(result.status,'requires_regulated_server_approval');
 assert.equal(result.realPaymentsEnabled,false);
 assert.equal(result.canDisburse,false);
 assert.equal(result.canGenerateRedeemableCode,false);
 assert.equal(evaluateCashPickupReadiness({...input,compliance:null}).status,'blocked');
});
