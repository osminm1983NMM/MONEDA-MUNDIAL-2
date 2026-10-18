import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFullMoneyJourney as preview} from '../src/digital-money/full-journey-demo.mjs';
test('Coin→Digital se muestra sin convertir el saldo a remesas',()=>{
 const p=preview({source:'coin_concept',destination:'HN',coinUnits:'10',coinUsdScenario:'0.25',digitalUsdScenario:'1'});
 assert.equal(p.conversionExample.hypotheticalDigitalUnits,'2.5');
 assert.equal(p.independentUsdExample,null);
 assert.equal(p.localCurrencyExample,null);
 assert.equal(p.canConvert,false); assert.equal(p.canSend,false);
 assert.equal(p.demoCreditsConvertible,false);
});
test('USD externo solo puede mostrar dos ejemplos independientes de cotización',()=>{
 const p=preview({source:'external_usd_scenario',destination:'NI',hypotheticalUsdCents:10000,manualLocalPerUsd:'36.5'});
 assert.equal(p.independentUsdExample.amountCents,10000);
 assert.equal(p.localCurrencyExample.amount,'3650.00');
 assert.equal(p.localCurrencyExample.guaranteed,false);
 assert.equal(p.steps.length,4);
 assert.equal(p.operational,false);
 assert.equal(p.realMoneyEnabled,false);
});
test('MWD y Digital no admiten ser usados como fondos para remesa',()=>{
 for(const source of ['demo_wallet','digital_concept']){
  const p=preview({source,destination:'HN',manualLocalPerUsd:'25'});
  assert.equal(p.conversionExample,null);
  assert.equal(p.independentUsdExample,null);
  assert.equal(p.canDebit,false);assert.equal(p.canWithdraw,false);
 }
});
test('escenarios no soportados fallan cerrados y sin creación de pagos',()=>{
 assert.equal(preview({source:'bank_live'}),null);
 assert.equal(preview({destination:'ZZ'}),null);
 assert.equal(preview({hypotheticalUsdCents:0}),null);
 const p=preview({source:'external_usd_scenario',destination:'HN',manualLocalPerUsd:'abc'});
 assert.equal(p.localCurrencyExample,null);
 assert.equal(p.canDisburse,false);
});

test('Digital→Coin se muestra únicamente como cálculo separado, sin dinero transferible',()=>{
 const p=preview({source:'digital_concept',destination:'NI',
  digitalUnits:'2.5',coinUsdScenario:'0.25',digitalUsdScenario:'1',
  hypotheticalUsdCents:10000,manualLocalPerUsd:'36.5'});
 assert.equal(p.inverseConversionExample.inputDigitalUnits,'2.5');
 assert.equal(p.inverseConversionExample.hypotheticalCoinUnits,'10');
 assert.equal(p.inverseConversionExample.canExecute,false);
 assert.equal(p.conversionExample,null);
 assert.equal(p.independentUsdExample,null);
 assert.equal(p.localCurrencyExample,null);
 for(const key of ['canTrade','canConvert','canDebit','canSend','canPayMerchant',
  'canWithdraw','canDisburse','realMoneyEnabled','operational'])assert.equal(p[key],false,key);
});
test('un valor Digital inválido nunca produce saldo ni activa operación',()=>{
 const p=preview({source:'digital_concept',digitalUnits:'0',
  coinUsdScenario:'0.25',digitalUsdScenario:'1'});
 assert.equal(p.inverseConversionExample,null);
 assert.equal(p.canSend,false);
 assert.equal(p.digitalIssued,false);
});

test('comisiones y slippage ilustrativos no producen una promesa ni fondos disponibles',()=>{
 const coin=preview({source:'coin_concept',coinUnits:'10',coinUsdScenario:'0.25',
  digitalUsdScenario:'1',feeBps:100,slippageBps:100});
 assert.equal(coin.conversionExample.hypotheticalDigitalUnits,'2.475');
 assert.equal(coin.conversionExample.illustrativeFeeDigitalUnits,'0.025');
 assert.equal(coin.conversionExample.riskAdjustedDigitalUnits,'2.45025');
 assert.equal(coin.conversionExample.isGuaranteedMinimum,false);
 assert.equal(coin.conversionExample.externalNetworkCostsIncluded,false);
 const digital=preview({source:'digital_concept',digitalUnits:'2.5',
  digitalUsdScenario:'1',coinUsdScenario:'0.25',feeBps:100,slippageBps:100});
 assert.equal(digital.inverseConversionExample.hypotheticalCoinUnits,'9.9');
 assert.equal(digital.inverseConversionExample.illustrativeFeeCoinUnits,'0.1');
 assert.equal(digital.inverseConversionExample.riskAdjustedCoinUnits,'9.801');
 assert.equal(digital.inverseConversionExample.isGuaranteedMinimum,false);
 assert.equal(digital.canConvert,false);
});
test('riesgo fuera de rango no activa conversiones ni toca la remesa externa',()=>{
 for(const feeBps of [-1,1001,3.14])assert.equal(
  preview({source:'coin_concept',feeBps}).conversionExample,null);
 for(const slippageBps of [-1,501,0.5])assert.equal(
  preview({source:'digital_concept',slippageBps}).inverseConversionExample,null);
 const external=preview({source:'external_usd_scenario',feeBps:-1});
 assert.equal(external.conversionExample,null);
 assert.equal(external.inverseConversionExample,null);
 assert.equal(external.canSend,false);
});
