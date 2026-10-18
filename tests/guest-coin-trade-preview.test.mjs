import test from 'node:test';
import assert from 'node:assert/strict';
import {GUEST_COIN_TRADE_REAL_FUNDS_ENABLED,GUEST_COIN_TRADE_ORDERS_ENABLED,
 getGuestCoinTradePreview} from '../src/guest-coin-trade-preview.mjs';

test('compra y venta hipotéticas no generan saldos ni operaciones',()=>{
 assert.equal(GUEST_COIN_TRADE_REAL_FUNDS_ENABLED,false);
 assert.equal(GUEST_COIN_TRADE_ORDERS_ENABLED,false);
 for(const side of ['buy','sell'])for(const language of ['es','en']){
  const v=getGuestCoinTradePreview({side,language,coinUnits:'10',coinUsdScenario:'0.25',feeBps:'100'});
  assert.equal(v.quote.grossUsd,'2.5');
  assert.equal(v.quote.illustrativeFeeUsd,'0.025');
  assert.equal(v.quote.hypotheticalBuyerTotalUsd,side==='buy'?'2.525':null);
  assert.equal(v.quote.hypotheticalSellerProceedsUsd,side==='sell'?'2.475':null);
  for(const key of ['bankConnected','blockchainConnected','tokenIssued','priceVerified',
    'custodyConnected','demoCreditsConvertible','canBuy','canSell','canWithdraw',
    'canTransfer','realMoneyEnabled'])assert.equal(v[key],false,key);
  assert.equal(v.quote.orderCreated,false);
  assert.equal(v.quote.canExecute,false);
  assert.ok(v.heading.length>10);
  assert.ok(Object.isFrozen(v.quote));
 }
});
test('importe inválido o comisión insegura no crea cotización',()=>{
 for(const params of [
  {side:'hold',coinUnits:'10',coinUsdScenario:'0.25'},
  {side:'buy',coinUnits:'10',coinUsdScenario:'0.25',feeBps:'1001'},
  {side:'buy',coinUnits:'10',coinUsdScenario:'0.25',feeBps:'-1'},
  {side:'buy',coinUnits:'10',coinUsdScenario:'0.25',feeBps:'1.5'},
  {side:'buy',coinUnits:10,coinUsdScenario:'0.25'},
 ])assert.equal(getGuestCoinTradePreview(params),null);
 for(const coinUnits of ['0','-3','1000.1234567','abc']){
  const v=getGuestCoinTradePreview({side:'buy',coinUnits,coinUsdScenario:'0.25'});
  assert.equal(v.quote,null);
  assert.equal(v.realMoneyEnabled,false);
 }
});
test('las etiquetas no confunden precios supuestos con cotizaciones de mercado',()=>{
 const data=JSON.stringify(getGuestCoinTradePreview({coinUnits:'10',coinUsdScenario:'0.25'}));
 assert.doesNotMatch(data,/sb_secret_|service_role|seedPhrase|privateKey|https?:\/\//);
 assert.match(data,/hipotético|hipotética|ilustrativa/i);
 assert.match(data,/NO EXISTEN COIN EMITIDAS/);
});
