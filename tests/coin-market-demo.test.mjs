import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCoinTradeScenario,COIN_TRADE_SCENARIO_SIDES}
 from '../src/digital-money/coin-market-demo.mjs';

test('comprar Coin es sólo presupuesto ficticio sin token ni fondos reales',()=>{
 const v=previewCoinTradeScenario({
  side:'buy',coinUnits:'10',coinUsdScenario:'0.25',feeBps:100
 });
 assert.deepEqual(COIN_TRADE_SCENARIO_SIDES,['buy','sell']);
 assert.equal(v.hypotheticalGrossUsd,'2.5');
 assert.equal(v.illustrativeFeeUsd,'0.025');
 assert.equal(v.hypotheticalBuyerTotalUsd,'2.525');
 assert.equal(v.hypotheticalSellerProceedsUsd,null);
 for(const k of ['canBuy','canSell','canWithdraw','canTransfer','executable',
  'realMoneyEnabled','coinIssued','demoCreditsSpendable','orderCreated',
  'bankSettlementConfirmed','marketPriceVerified','liquidityConfirmed']){
  assert.equal(v[k],false,k);
 }
});
test('vender Coin calcula resultado ilustrativo y no una venta bancaria',()=>{
 const v=previewCoinTradeScenario({
  side:'sell',coinUnits:'10',coinUsdScenario:'0.25',feeBps:100
 });
 assert.equal(v.hypotheticalGrossUsd,'2.5');
 assert.equal(v.illustrativeFeeUsd,'0.025');
 assert.equal(v.hypotheticalSellerProceedsUsd,'2.475');
 assert.equal(v.hypotheticalBuyerTotalUsd,null);
 assert.equal(v.tradingVenueConnected,false);
 assert.equal(v.realMoneyEnabled,false);
});
test('comisiones redondeadas hacia arriba no sobreestiman el neto ficticio',()=>{
 const v=previewCoinTradeScenario({
  side:'sell',coinUnits:'1',coinUsdScenario:'0.333333',feeBps:100
 });
 assert.equal(v.illustrativeFeeUsd,'0.003334');
 assert.equal(v.hypotheticalSellerProceedsUsd,'0.329999');
});
test('no se aceptan importes negativos, notación exponencial o precio 0',()=>{
 for(const args of [
  {side:'buy',coinUnits:'0',coinUsdScenario:'1'},
  {side:'sell',coinUnits:'1',coinUsdScenario:'0'},
  {side:'sell',coinUnits:'-1',coinUsdScenario:'1'},
  {side:'buy',coinUnits:'1e6',coinUsdScenario:'1'},
  {side:'buy',coinUnits:'1.1234567',coinUsdScenario:'1'},
  {side:'buy',coinUnits:'1',coinUsdScenario:'0.0000001'},
  {side:'sell',coinUnits:'1',coinUsdScenario:'1',feeBps:-1},
  {side:'sell',coinUnits:'1',coinUsdScenario:'1',feeBps:1001},
  {side:'hold',coinUnits:'1',coinUsdScenario:'1'},
  {side:'buy',coinUnits:'1',coinUsdScenario:'1',feeBps:100.25},
 ])assert.equal(previewCoinTradeScenario(args),null);
});
test('precios extremadamente bajos no inventan dólares con valor 0',()=>{
 assert.equal(previewCoinTradeScenario({
  side:'sell',coinUnits:'0.000001',coinUsdScenario:'0.000001'
 }),null);
});
