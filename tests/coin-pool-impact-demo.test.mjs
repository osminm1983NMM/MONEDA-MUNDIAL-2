import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCoinPoolImpact,AMM_RESEARCH_SIDES} from '../src/digital-money/coin-pool-impact-demo.mjs';
const base={poolCoinUnits:'100000',poolQuoteUsdCents:'1000000'};
test('comprar Coin imaginarias eleva el precio de un AMM de ejemplo',()=>{
 const r=previewCoinPoolImpact({...base,side:'buy_coin',tradeInputUnits:'10000'});
 assert.deepEqual(AMM_RESEARCH_SIDES,['buy_coin','sell_coin']);
 assert.equal(r.initialSpotPriceUsd,'0.1');
 assert.equal(r.hypotheticalOutputUnits,'990');
 assert.ok(Number(r.hypotheticalAfterTradeSpotPriceUsd)>0.1);
 assert.equal(r.endingPoolQuoteUsdCents,'1010000');
 assert.equal(BigInt(r.endingPoolCoinUnits)+BigInt(r.hypotheticalOutputUnits),100000n);
 assert.equal(r.buyEnabled,false);
 assert.equal(r.realMoneyEnabled,false);
});
test('vender Coin imaginarias reduce su precio sin acreditar saldo bancario',()=>{
 const r=previewCoinPoolImpact({...base,side:'sell_coin',tradeInputUnits:'1000'});
 assert.equal(r.initialSpotPriceUsd,'0.1');
 assert.equal(r.hypotheticalOutputUnits,'9900');
 assert.equal(r.endingPoolCoinUnits,'101000');
 assert.ok(Number(r.hypotheticalAfterTradeSpotPriceUsd)<0.1);
 assert.equal(r.quoteExecutable,false);
 assert.equal(r.tokenIssued,false);
});
test('fee incluido jamás revela mercado, ni permite transacciones reales',()=>{
 const buy=previewCoinPoolImpact({...base,side:'buy_coin',tradeInputUnits:'10000',feeBps:100});
 const sell=previewCoinPoolImpact({...base,side:'sell_coin',tradeInputUnits:'1000',feeBps:100});
 assert.equal(buy.feeInputUnits,'100');
 assert.equal(sell.feeInputUnits,'10');
 assert.ok(BigInt(buy.hypotheticalOutputUnits)<990n);
 assert.ok(BigInt(sell.hypotheticalOutputUnits)<9900n);
 for(const r of [buy,sell]){
  for(const key of ['externalPriceKnown','poolDeployed','networkDeployed',
   'tokenIssued','quoteExecutable','buyEnabled','sellEnabled','realMoneyEnabled'])
   assert.equal(r[key],false,key);
 }
});
test('seguridad matemática: no permitir cero, precios ficticios con salida cero ni fondos inválidos',()=>{
 for(const p of [
  {...base,side:'buy_coin',tradeInputUnits:'0'},
  {...base,side:'buy_coin',tradeInputUnits:'1',feeBps:100},
  {...base,side:'buy_coin',tradeInputUnits:'1'},
  {...base,side:'sell_coin',tradeInputUnits:'1',feeBps:100},
  {...base,side:'sell_coin',tradeInputUnits:'-2'},
  {...base,side:'sell_coin',tradeInputUnits:'1e4'},
  {...base,side:'sell_coin',tradeInputUnits:'10',feeBps:1001},
  {...base,side:'buy_coin',tradeInputUnits:'100',poolQuoteUsdCents:'1'},
  {...base,side:'buy_coin',tradeInputUnits:'100',poolCoinUnits:'1'},
  {...base,side:'hold_coin',tradeInputUnits:'100'},
 ]) assert.equal(previewCoinPoolImpact(p),null,JSON.stringify(p));
});

test('medición de impacto spot produce alertas sin permitir operaciones',()=>{
 const small=previewCoinPoolImpact({...base,side:'buy_coin',tradeInputUnits:'10000'});
 const large=previewCoinPoolImpact({...base,side:'buy_coin',tradeInputUnits:'100000'});
 assert.equal(small.highSpotPriceImpactWarning,false);
 assert.equal(large.highSpotPriceImpactWarning,true);
 assert.ok(BigInt(large.hypotheticalSpotPriceChangeBps)>
           BigInt(small.hypotheticalSpotPriceChangeBps));
 assert.equal(large.priceImpactIsNotExecutionSlippage,true);
 assert.equal(large.quoteExecutable,false);
 const sale=previewCoinPoolImpact({...base,side:'sell_coin',tradeInputUnits:'10000'});
 assert.ok(BigInt(sale.hypotheticalSpotPriceChangeBps)>0n);
 assert.equal(sale.realMoneyEnabled,false);
});
