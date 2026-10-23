import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockCoinSalePortfolio} from '../src/digital-money/mock-coin-fifo-sale.mjs';
let now=1800000000000;
const config={mode:'mock',scenarioUnitPriceCents:25,feeBps:100,
 marketBuyerCapacityUnits:'1000',sellers:{
  'SIM-US-SELL001':[
   {coinUnits:'100',acquisitionUnitPriceCents:10},
   {coinUnits:'200',acquisitionUnitPriceCents:20},
  ],
  'SIM-US-SELL002':[{coinUnits:'50',acquisitionUnitPriceCents:15}]
 }};
const make=(override={})=>{now=1800000000000;
 return createMockCoinSalePortfolio({fixture:{...config,...override},clock:()=>now});};
const preview=(m,id='sale-request-001',alias='SIM-US-SELL001',qty='100',minimum=2400)=>
 m.previewMockSale({requestId:id,sellerAlias:alias,coinUnits:qty,minNetUsdCents:minimum});
const confirm=(m,q,extra={})=>m.confirmMockSale({requestId:q.requestId,sellerAlias:q.sellerAlias,
 quoteId:q.quoteId,acceptedTerms:true,
 acknowledgedNetUsdCents:q.illustrativeNetUsdCents,
 acknowledgedDistinctRepeat:q.duplicateRiskDetected,...extra});
test('FIFO: 100 Coin a 25c menos 1% y costo original a 10c',()=>{
 const m=make(),q=preview(m);
 assert.equal(q.hypotheticalGrossUsdCents,'2500');
 assert.equal(q.illustrativeFeeUsdCents,'25');
 assert.equal(q.illustrativeNetUsdCents,'2475');
 assert.equal(q.illustrativeFifoCostBasisUsdCents,'1000');
 assert.equal(q.illustrativeProfitLossUsdCents,'1475');
 assert.equal(q.realMarketPriceVerified,false);
 const r=confirm(m,q);
 assert.equal(r.illustrativeProfitLossUsdCents,'1475');
 assert.equal(r.actualProfitRealized,false);
 assert.equal(r.realMoneyEnabled,false);
 assert.equal(m.inspectSyntheticPortfolio('SIM-US-SELL001').remainingCoinUnits,'200');
 assert.equal(m.inspectMockMarketCapacity().buyerFixtureCoinHoldings,'100');
});
test('FIFO usa primero lote antiguo cuando una venta cruza dos lotes',()=>{
 const m=make(),q=preview(m,'sale-request-fifo-001','SIM-US-SELL001','150',3600);
 assert.equal(q.illustrativeFifoCostBasisUsdCents,'2000');
 assert.equal(q.illustrativeNetUsdCents,'3712');
 assert.equal(q.illustrativeProfitLossUsdCents,'1712');
 confirm(m,q);
 assert.equal(m.inspectSyntheticPortfolio('SIM-US-SELL001').remainingCoinUnits,'150');
});
test('cotización con precio modificado no puede confirmarse',()=>{
 const m=make(),q=preview(m);
 m.simulateFixturePriceRevision(30);
 assert.throws(()=>confirm(m,q),/Precio modificado/);
 assert.equal(m.inspectSyntheticPortfolio('SIM-US-SELL001').remainingCoinUnits,'300');
});
test('no permite doble venta ni repetir una referencia para cambiar la operación',()=>{
 const m=make(),q=preview(m),a=confirm(m,q),b=confirm(m,q);
 assert.equal(a.saleId,b.saleId);
 assert.equal(b.alreadyProcessed,true);
 assert.equal(m.sanitizedAudit().length,1);
 assert.throws(()=>preview(m,q.requestId,q.sellerAlias,'101'),/reutilizada/);
});
test('segunda venta similar exige autorización especial',()=>{
 const m=make(),q=preview(m),first=confirm(m,q);
 const q2=preview(m,'sale-request-002');
 assert.equal(q2.duplicateRiskDetected,true);
 assert.equal(q2.previouslySimilarSaleId,first.saleId);
 assert.throws(()=>confirm(m,q2,{acknowledgedDistinctRepeat:false}),/consentimiento/);
 assert.equal(confirm(m,q2).status,'mock_sale_recorded');
});
test('dos cotizaciones antiguas no pueden vender mismas unidades',()=>{
 const m=make(),a=preview(m,'sale-request-one','SIM-US-SELL001','250',6000),
 b=preview(m,'sale-request-two','SIM-US-SELL001','100',2400);
 confirm(m,a);
 assert.throws(()=>confirm(m,b),/Cartera modificada/);
 assert.equal(m.inspectSyntheticPortfolio('SIM-US-SELL001').remainingCoinUnits,'50');
});
test('monto mínimo, límite de liquidez, vencimiento, otro titular y datos privados',()=>{
 const m=make({marketBuyerCapacityUnits:'100'});
 assert.throws(()=>preview(m,'sale-minimum-001','SIM-US-SELL001','100',2490),/mínimo/);
 assert.throws(()=>preview(m,'sale-capacity-001','SIM-US-SELL001','150',3600),/insuficientes/);
 const q=preview(m);
 assert.throws(()=>m.inspectMockSale({requestId:q.requestId,sellerAlias:'SIM-US-SELL002'}),/otra cuenta/);
 now+=120001;
 assert.throws(()=>confirm(m,q),/caducada/);
 assert.throws(()=>m.previewMockSale({...{requestId:'sale-pii-0001',sellerAlias:'SIM-US-SELL001',coinUnits:'1',minNetUsdCents:0},cardNumber:'1111'}),/No enviar/);
 assert.equal(m.sanitizedAudit().length,0);
});
test('registrar pérdida ficticia y preservar inventario sin tokens reales',()=>{
 const m=make({scenarioUnitPriceCents:5}),q=preview(m,'sale-loss-0001','SIM-US-SELL001','100',0);
 assert.equal(q.illustrativeNetUsdCents,'495');
 assert.equal(q.illustrativeProfitLossUsdCents,'-505');
 confirm(m,q);
 assert.equal(m.inspectSyntheticPortfolio('SIM-US-SELL001').simulatedProfitLossCents,'-505');
 assert.equal(m.inspectMockMarketCapacity().liquidityVerified,false);
});
test('saldo imposible, modo real y cantidades inválidas se rechazan',()=>{
 assert.throws(()=>make({mode:'live'}),/prohibido/);
 const m=make();
 assert.throws(()=>preview(m,'sale-bad-0001','SIM-US-SELL001','0',0),/inválida/);
 assert.throws(()=>preview(m,'sale-bad-0002','SIM-US-SELL001','301',0),/insuficientes/);
 assert.throws(()=>m.simulateFixturePriceRevision(0),/inválido/);
});
