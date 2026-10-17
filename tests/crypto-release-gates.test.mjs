import test from 'node:test';
import assert from 'node:assert/strict';
import {CRYPTO_ASSETS,CRYPTO_RELEASE_PHASES,assessCryptoReleasePhase,getCryptoProductSeparation}
 from '../src/digital-money/crypto-release-gates.mjs';
const asOf='2026-10-17';
const evidenceFor=phase=>Object.fromEntries(CRYPTO_RELEASE_PHASES[phase].map((key,i)=>
 [key,{scope:phase,reference:'DOC-RESEARCH-'+String(i).padStart(3,'0'),
   reviewedOn:'2026-10-01',expiresOn:'2026-12-31',source:'internal_design'}]));
test('créditos ficticios no son criptomoneda ni canjeables',()=>{
 const p=getCryptoProductSeparation();
 assert.equal(CRYPTO_ASSETS.demo.isCrypto,false);
 assert.equal(p.demoToCoin,false);assert.equal(p.demoToDigital,false);
 assert.equal(p.demoToFiat,false);assert.equal(p.blockchainConnected,false);
 assert.equal(CRYPTO_ASSETS.coin.priceUsd,null);
 assert.equal(CRYPTO_ASSETS.digital.usdPegGuaranteed,false);
 assert.equal(CRYPTO_ASSETS.coin.tokenIssued,false);
 assert.equal(CRYPTO_ASSETS.digital.tokenIssued,false);
});
test('Coin y Digital son proyectos independientes con fases propias',()=>{
 for(const phase of Object.keys(CRYPTO_RELEASE_PHASES)){
  const a=assessCryptoReleasePhase({phase,asOf});
  assert.equal(a.collectedCount,0);
  assert.equal(a.missingEvidence.length,a.requirementCount);
  assert.equal(a.documentsCollected,false);
  assert.equal(a.realFundsEnabled,false);
 }
});
test('todos los documentos auto-declarados NO activan crypto ni siquiera testnet',()=>{
 for(const phase of Object.keys(CRYPTO_RELEASE_PHASES)){
  const report=assessCryptoReleasePhase({phase,asOf,evidence:evidenceFor(phase)});
  assert.equal(report.documentsCollected,true);
  assert.equal(report.reviewStatus,'independent_review_and_licensing_required');
  for(const k of ['contractDeployAllowed','tokenIssued','stablecoinIssued',
   'stablecoinRedeemable','customerFundsHeld','marketTradingEnabled',
   'coinDigitalConversionEnabled','merchantPaymentsEnabled',
   'cryptoRemittanceEnabled','custodyConnected','realFundsEnabled']){
   assert.equal(report[k],false,phase+':'+k);
  }
  assert.equal(report.verifiedPriceUsd,null);
  assert.equal(report.approvedCoinSupply,null);
  assert.equal(JSON.stringify(report).includes('DOC-RESEARCH'),false);
 }
});
test('documento de Coin no autoriza moneda Digital ni intercambios',()=>{
 const v=assessCryptoReleasePhase({
  phase:'coin_to_digital_exchange',asOf,
  evidence:evidenceFor('coin_public_issuance'),
 });
 assert.equal(v.collectedCount,0);
 assert.equal(v.coinDigitalConversionEnabled,false);
});
test('el documento exige vinculación a fase y vigencia exactas',()=>{
 const phase='digital_stablecoin',records=evidenceFor(phase),key=CRYPTO_RELEASE_PHASES[phase][0];
 records[key].scope='coin_public_issuance';
 assert.ok(assessCryptoReleasePhase({phase,asOf,evidence:records}).missingEvidence.includes(key));
 records[key].scope=phase;records[key].expiresOn='2026-10-16';
 assert.ok(assessCryptoReleasePhase({phase,asOf,evidence:records}).missingEvidence.includes(key));
 records[key].expiresOn='2026-02-30';
 assert.ok(assessCryptoReleasePhase({phase,asOf,evidence:records}).missingEvidence.includes(key));
});
test('no acepta secretos, campos adicionales, fechas futuras o valores engañosos',()=>{
 const phase='coin_public_issuance',records=evidenceFor(phase),key=CRYPTO_RELEASE_PHASES[phase][0];
 records[key].secret='never-store-private-key';
 assert.ok(assessCryptoReleasePhase({phase,asOf,evidence:records}).missingEvidence.includes(key));
 delete records[key].secret;records[key].reviewedOn='2026-11-01';
 assert.ok(assessCryptoReleasePhase({phase,asOf,evidence:records}).missingEvidence.includes(key));
 assert.equal(assessCryptoReleasePhase({phase,asOf:'2026-13-01',evidence:evidenceFor(phase)}).dateValid,false);
 assert.equal(assessCryptoReleasePhase({phase:'issue_anything',asOf}).reviewStatus,'invalid_input');
 assert.equal(assessCryptoReleasePhase({phase,asOf,evidence:null}).documentsCollected,false);
});
