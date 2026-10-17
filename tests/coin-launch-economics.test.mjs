import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCoinLaunchEconomics} from '../src/digital-money/coin-launch-economics.mjs';

const demo={maximumSupplyUnits:'100000000',initiallyMintedUnits:'100000000',
 initiallyCirculatingUnits:'20000000',poolCoinUnits:'100000',
 poolQuoteUsdCents:'1000000'};
test('distingue suministro máximo, circulación y precio matemático de pool',()=>{
 const v=previewCoinLaunchEconomics(demo);
 assert.equal(v.hypotheticalOpeningReferencePriceUsd,'0.1');
 assert.equal(v.hypotheticalCirculatingValueUsd,'2000000');
 assert.equal(v.hypotheticalFullyDilutedValuationUsd,'10000000');
 assert.equal(v.initialFloatPercentBps,'2000');
 assert.equal(v.illustrativeOnly,true);
});
test('cap/valoración hipotética NO equivale a caja, ingreso ni precio de mercado',()=>{
 const v=previewCoinLaunchEconomics(demo);
 for(const key of ['launchPriceApproved','marketPriceKnown','officialSupplyChosen',
 'liquidityProvided','poolDeployed','realStablecoinConfirmed',
 'tokenIssued','marketTradingEnabled','canExecute'])assert.equal(v[key],false,key);
 assert.equal(v.noGuaranteeOfLiquidity,true);
 assert.equal(v.noPromiseOfReturns,true);
});
test('separa emitidas y retenidas fuera de la circulación',()=>{
 const v=previewCoinLaunchEconomics({...demo,initiallyMintedUnits:'30000000'});
 assert.equal(v.remainingUnmintedUnits,'70000000');
 assert.equal(v.mintedNotCirculatingUnits,'10000000');
 assert.equal(v.hypotheticalOpeningReferencePriceUsd,'0.1');
});
test('impide presupuesto de liquidez superior a circulación',()=>{
 for(const scenario of [
  {...demo,initiallyMintedUnits:'150000000'},
  {...demo,initiallyCirculatingUnits:'110000000'},
  {...demo,poolCoinUnits:'30000000'},
  {...demo,poolCoinUnits:'0'},
  {...demo,poolQuoteUsdCents:'0'},
  {...demo,maximumSupplyUnits:'100.5'},
  {...demo,poolQuoteUsdCents:'-100'},
  {...demo,maximumSupplyUnits:100000000},
  {...demo,initiallyCirculatingUnits:'20e6'},
  {...demo,poolQuoteUsdCents:'1',poolCoinUnits:'1000000000000'},
 ])assert.equal(previewCoinLaunchEconomics(scenario),null);
});
