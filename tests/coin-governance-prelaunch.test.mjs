import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCoinTreasuryGovernance as inspect,assessCoinPrelaunchEvidence as legal,
 COIN_PRELAUNCH_REQUIREMENTS} from '../src/digital-money/coin-governance-prelaunch.mjs';

const powers={unlimitedFutureMint:false,clawbackFromBuyers:false,
 hiddenTransferRestrictions:false,guaranteedProfitMarketing:false};
const sample=(other={})=>({
 hypotheticalMaxSupplyUnits:'1000000000',
 initialCompanyTreasuryUnits:'1000000000',
 plannedPublicUnits:'150000000',plannedPartnerUnits:'50000000',
 plannedLiquidityUnits:'100000000',plannedCommunityUnits:'0',
 adminPowers:powers,...other,
});

test('1,000 millones de Coin son sólo escenario; inventario, socios, venta y liquidez separados',()=>{
 const report=inspect(sample());
 assert.equal(report.hypotheticalMaxSupplyUnits,'1000000000');
 assert.equal(report.initiallyControlledTreasuryUnits,'1000000000');
 assert.equal(report.companyTreasuryRemainingAfterPlan,'700000000');
 assert.equal(report.totalPlannedDistributions,'300000000');
 assert.equal(report.proposedDistributions.partnerProgram,'50000000');
 assert.equal(report.proposedDistributionShareBps.partnerProgram,'500');
 assert.equal(report.proposedDistributionShareBps.companyRemaining,'7000');
 assert.equal(report.concentrationRiskSignals.includes('initial_treasury_concentration_requires_review'),true);
 for(const x of ['publicSaleAuthorized','tokenIssued','realFundsEnabled',
   'companyRealTreasuryOwned','legalClassificationVerified',
   'externalExchangeListingApproved','digitalStablecoinIssued'])
  assert.equal(report[x],false,x);
 assert.equal(report.companyDoesNotOwnTokensSoldToBuyers,true);
 assert.equal(report.partnersAreNotAutomaticallyPaid,true);
});

test('100% en tesorería inicialmente no es autoridad universal sobre compradores',()=>{
 const report=inspect(sample({plannedPublicUnits:'0',plannedPartnerUnits:'0',plannedLiquidityUnits:'0'}));
 assert.equal(report.companyTreasuryRemainingAfterPlan,'1000000000');
 assert.equal(report.noRightToClawBackBuyersTokens,true);
 assert.equal(report.companyDoesNotOwnTokensSoldToBuyers,true);
 assert.equal(report.publicSaleAuthorized,false);
});

test('riesgos de impresión ilimitada, confiscación, restricciones ocultas y rendimientos prometidos',()=>{
 const report=inspect(sample({adminPowers:{
  unlimitedFutureMint:true,clawbackFromBuyers:true,
  hiddenTransferRestrictions:true,guaranteedProfitMarketing:true,
 }}));
 assert.equal(report.concentrationRiskSignals.length,5);
 assert.ok(report.concentrationRiskSignals.includes('unilateral_holder_clawback_requires_review'));
 assert.ok(report.concentrationRiskSignals.includes('profit_guarantee_marketing_requires_review'));
 assert.equal(report.publicSaleAuthorized,false);
});

test('propuestas que exceden las monedas disponibles no producen distribución',()=>{
 for(const v of [
  {...sample(),plannedPublicUnits:'1000000001'},
  {...sample(),initialCompanyTreasuryUnits:'200000000'},
  {...sample(),plannedPartnerUnits:'-1'},
  {...sample(),plannedPartnerUnits:'100.5'},
  {...sample(),plannedPartnerUnits:100000000},
  {...sample(),hypotheticalMaxSupplyUnits:'0'},
  {...sample(),hypotheticalMaxSupplyUnits:'1000000000000000001'},
  {...sample(),privateKey:'unsafe'},
  {...sample(),adminPowers:{...powers,clawbackFromBuyers:'false'}},
  {...sample(),adminPowers:{...powers,ownerPrivateKey:'unsafe'}},
 ])assert.equal(inspect(v),null);
});

const evidence=(asOf='2026-10-23')=>Object.fromEntries(
 COIN_PRELAUNCH_REQUIREMENTS.map((x,i)=>[x.id,{
  scope:'coin_primary_issuance_us',
  reviewerRole:x.requiredReviewer,
  reference:'EXTERNAL-EXAMPLE-'+String(i).padStart(3,'0'),
  reviewedOn:'2026-10-01',expiresOn:'2026-12-31',
 }])
);

test('sin dictámenes y licencias, no habilita una oferta pública',()=>{
 const r=legal({asOf:'2026-10-23'});
 assert.equal(r.missingRequirements.length,r.requirementsTotal);
 assert.equal(r.publicOfferAllowed,false);
 assert.equal(r.stablecoinCanBeIssued,false);
 assert.equal(r.realFundsEnabled,false);
});

test('hasta registros inventados que parecen completos NO certifican legalidad',()=>{
 const r=legal({asOf:'2026-10-23',records:evidence()});
 assert.equal(r.documentsDescribed,true);
 assert.equal(r.structurallyDescribedRecords,r.requirementsTotal);
 assert.equal(r.independentlyVerified,false);
 assert.equal(r.legalCounselApprovedLaunch,false);
 assert.equal(r.approvalByRegulatorConfirmed,false);
 assert.equal(r.publicOfferAllowed,false);
 assert.equal(r.companyCanCollectSaleProceeds,false);
 assert.equal(r.onchainDeployAllowed,false);
 assert.equal(r.stablecoinCanBeIssued,false);
 assert.equal(JSON.stringify(r).includes('EXTERNAL-EXAMPLE-'),false);
});

test('rechaza documentos de otra operación, fuente incorrecta, vencidos o con secretos',()=>{
 const all=evidence();
 const key=COIN_PRELAUNCH_REQUIREMENTS[0].id;
 all[key].scope='coin_to_digital_exchange';
 assert.ok(legal({asOf:'2026-10-23',records:all}).missingRequirements.includes(key));
 all[key].scope='coin_primary_issuance_us';all[key].reviewerRole='founder';
 assert.ok(legal({asOf:'2026-10-23',records:all}).missingRequirements.includes(key));
 all[key].reviewerRole='independent_legal_counsel';all[key].expiresOn='2026-10-22';
 assert.ok(legal({asOf:'2026-10-23',records:all}).missingRequirements.includes(key));
 all[key].expiresOn='2026-12-31';all[key].privateKey='never-request';
 assert.ok(legal({asOf:'2026-10-23',records:all}).missingRequirements.includes(key));
 assert.equal(legal({asOf:'2026-02-30',records:evidence()}).inputDateValid,false);
 assert.equal(legal({asOf:'2026-10-23',records:null}).documentsDescribed,false);
});
