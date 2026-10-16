import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_CONCEPTS,previewCoinToDigitalScenario} from '../src/digital-money/coin-to-digital-design.mjs';
test('nombres independientes sin activos emitidos',()=>{
 assert.equal(ASSET_CONCEPTS.coin.name,'Moneda Mundial Coin');
 assert.equal(ASSET_CONCEPTS.digital.name,'Moneda Mundial Digital');
 assert.equal(ASSET_CONCEPTS.coin.tokenIssued,false);
 assert.equal(ASSET_CONCEPTS.digital.tokenIssued,false);
});
test('10 Coin hipotéticas de USD 0.25 equivalen a 2.5 unidades estables hipotéticas de USD 1',()=>{
 const v=previewCoinToDigitalScenario({coinUnits:'10',coinUsdScenario:'0.25',digitalUsdScenario:'1'});
 assert.equal(v.hypotheticalUsdValue,'2.5');
 assert.equal(v.hypotheticalNetDigitalUnits,'2.5');
 assert.equal(v.canExecute,false);assert.equal(v.realMarketPriceKnown,false);
 assert.equal(v.minimumReceiveGuaranteed,false);
});
test('no promete paridad: precio digital también se introduce manualmente',()=>{
 const v=previewCoinToDigitalScenario({coinUnits:'10',coinUsdScenario:'0.25',digitalUsdScenario:'0.99',feeBps:100,slippageBps:50});
 assert.equal(v.hypotheticalGrossDigitalUnits,'2.525252');
 assert.equal(v.hypotheticalFeeDigitalUnits,undefined);
 assert.equal(v.illustrativeFeeDigitalUnits,'0.025253');
 assert.equal(v.hypotheticalNetDigitalUnits,'2.499999');
 assert.equal(v.hypotheticalStressDigitalUnits,'2.487499');
});
test('rechaza divisiones por cero, comisiones inválidas e importes incompletos',()=>{
 for(const args of [
 {coinUnits:'0',coinUsdScenario:'1',digitalUsdScenario:'1'},
 {coinUnits:'1',coinUsdScenario:'0',digitalUsdScenario:'1'},
 {coinUnits:'1',coinUsdScenario:'1',digitalUsdScenario:'0'},
 {coinUnits:'1.1234567',coinUsdScenario:'1',digitalUsdScenario:'1'},
 {coinUnits:'1',coinUsdScenario:'1',digitalUsdScenario:'1',feeBps:1001},
 {coinUnits:'1',coinUsdScenario:'1',digitalUsdScenario:'1',slippageBps:501}
 ])assert.equal(previewCoinToDigitalScenario(args),null);
});
