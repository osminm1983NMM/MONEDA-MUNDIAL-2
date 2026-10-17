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
