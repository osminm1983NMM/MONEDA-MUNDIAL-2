import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN_LAUNCH_EXAMPLES,getCoinLaunchExample,previewCoinLaunchFromDollars}
 from '../src/digital-money/coin-launch-presets.mjs';

test('100 millones y 1000 millones no implican precio fijo de Coin',()=>{
 const a=previewCoinLaunchFromDollars(getCoinLaunchExample('100m'));
 const b=previewCoinLaunchFromDollars(getCoinLaunchExample('1000m'));
 assert.equal(COIN_LAUNCH_EXAMPLES.length,2);
 assert.equal(a.hypotheticalOpeningReferencePriceUsd,'0.1');
 assert.equal(b.hypotheticalOpeningReferencePriceUsd,'0.01');
 assert.equal(a.hypotheticalCirculatingValueUsd,'2000000');
 assert.equal(b.hypotheticalCirculatingValueUsd,'2000000');
 assert.equal(a.poolQuoteUsdScenario,'10000.00');
 assert.equal(a.fairMarketPriceDetermined,false);
 assert.equal(b.launchPriceApproved,false);
 assert.equal(a.circulatingValueIsNotCash,true);
 assert.equal(b.liquidityAvailableForRedemption,false);
});
test('en USD se aceptan centavos pero no flotantes, signos ni notación',()=>{
 const p=getCoinLaunchExample('100m');
 for(const amount of ['-2','1e3','10.001','10000,00','00.1','0','0.00',10000,' 100']){
  assert.equal(previewCoinLaunchFromDollars({...p,poolQuoteUsd:amount}),null,String(amount));
 }
 assert.equal(previewCoinLaunchFromDollars({...p,poolQuoteUsd:'10000.50'})
  .illustrativePoolQuoteUsdCents,'1000050');
});
test('no convierte oferta ilegal o inconsistente en cotización oficial',()=>{
 const p=getCoinLaunchExample('100m');
 for(const props of [{maximumSupplyUnits:'1'},
  {initiallyCirculatingUnits:'200000000'},
  {poolCoinUnits:'21000000'},
  {poolCoinUnits:'0'}, {network:'mainnet'}]){
  assert.equal(previewCoinLaunchFromDollars({...p,...props}),null);
 }
 assert.equal(getCoinLaunchExample('oficial'),null);
});
