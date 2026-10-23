import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCoinLiquidityRisk as risk,previewCoinLiquidityStress as stress} from '../src/digital-money/coin-liquidity-risk-demo.mjs';
const sample={maximumSupplyUnits:'1000000000',circulatingCoinUnits:'1000000',
poolCoinUnits:'100000',poolQuoteUsdCents:'1000000',sellCoinUnits:'1000',
poolFeeBps:100,maxAllowedShortfallBps:500,minimumReceiveUsdCents:'9000'};
test('informa resultados ilusorios, nunca liquidez o garantía de precio real',()=>{
 const r=risk(sample);
 assert.ok(r);
 assert.equal(r.hypotheticalSpotReferenceUsd,'0.1');
 assert.ok(BigInt(r.hypotheticalReceiveUsdCents)>0n);
 assert.ok(BigInt(r.hypotheticalReceiveUsdCents)<10000n);
 assert.equal(r.hypotheticalSpotValueUsdCents,'10000');
 assert.equal(r.quoteExecutable,false);
 assert.equal(r.realLiquidityVerified,false);
 assert.equal(r.companyPriceSupportPromised,false);
 assert.equal(r.issuerHasBuybackObligation,false);
 assert.equal(r.realMoneyEnabled,false);
});
test('una venta muy grande produce alertas por pérdida relativa y drenaje',()=>{
 const r=risk({...sample,sellCoinUnits:'100000',
  minimumReceiveUsdCents:'900000',maxAllowedShortfallBps:500});
 assert.ok(r);
 assert.equal(r.illustrativeLimitBreached,true);
 assert.ok(r.warnings.includes('simulated_shortfall_exceeds_customer_limit'));
 assert.ok(r.warnings.includes('large_hypothetical_spot_price_movement'));
 assert.ok(r.warnings.includes('large_fraction_of_pool_quote_reserves_used'));
 assert.equal(r.canTrade,false);
});
test('un mínimo de recepción no alcanzado bloquea solo hipotéticamente',()=>{
 const r=risk({...sample,minimumReceiveUsdCents:'10000',maxAllowedShortfallBps:10000});
 assert.equal(r.illustrativeLimitBreached,true);
 assert.ok(r.warnings.includes('simulated_net_below_customer_minimum'));
});
test('el caso sin alertas no habilita negociar activos auténticos',()=>{
 const r=risk({...sample,poolFeeBps:0,minimumReceiveUsdCents:'0'});
 assert.equal(r.illustrativeLimitBreached,false);
 assert.equal(r.realMoneyEnabled,false);
 assert.equal(r.quoteExecutable,false);
});
test('escenarios de 1%, 5%, 10% y 25% no se acumulan ni crean órdenes',()=>{
 const r=stress({maximumSupplyUnits:'1000000000',
 circulatingCoinUnits:'1000000',poolCoinUnits:'100000',
 poolQuoteUsdCents:'1000000',poolFeeBps:100});
 assert.deepEqual(r.results.map(x=>x.hypotheticalCirculatingSellShareBps),[100,500,1000,2500]);
 assert.equal(r.simulationsIndependent,true);
 assert.equal(r.scenariosNotCombined,true);
 assert.equal(r.noCompanyBuybackPromised,true);
 assert.equal(r.realMoneyEnabled,false);
 assert.equal(r.results[0].modeled,true);
 assert.equal(r.results[3].modeled,true);
});
test('rechaza números falsos, datos personales, moneda con más circulación que emisión',()=>{
 for(const x of [
 {...sample,maximumSupplyUnits:'99999'},
 {...sample,circulatingCoinUnits:'1000000001'},
 {...sample,sellCoinUnits:'1000001'},
 {...sample,poolCoinUnits:'1000001'},
 {...sample,poolQuoteUsdCents:'0'},
 {...sample,poolFeeBps:-1},
 {...sample,poolFeeBps:1001},
 {...sample,maxAllowedShortfallBps:10001},
 {...sample,minimumReceiveUsdCents:'-1'},
 {...sample,sellCoinUnits:'1e6'},
 {...sample,sellCoinUnits:'5.5'},
 {...sample,bankAccount:'1234'}
 ])assert.equal(risk(x),null,JSON.stringify(x));
 assert.equal(stress({...sample,sellSharesBps:[100,100]}),null);
});
