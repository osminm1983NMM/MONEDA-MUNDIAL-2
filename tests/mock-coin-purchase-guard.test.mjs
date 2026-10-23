import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockCoinPrimarySale} from '../src/digital-money/mock-coin-primary-sale.mjs';
import {createMockCoinPurchaseGuard} from '../src/digital-money/mock-coin-purchase-guard.mjs';

let time=1800000000000;
const config={mode:'mock',maximumSupplyUnits:'1000000000',
 treasuryInventoryUnits:'1000000000',hypotheticalPriceUsdCents:10,
 feeBps:150,partnerFeeShareBps:3000};
const make=(options={})=>{
 time=1800000000000;
 const sale=createMockCoinPrimarySale({clock:()=>time,config:{...config,...(options.config||{})}});
 const engine=options.overrideSale?options.overrideSale(sale):sale;
 const guard=createMockCoinPurchaseGuard({primarySale:engine,clock:()=>time});
 return {sale,guard};
};
const request=(id='first',buyerAlias='SIM-US-BUYER001',extra={})=>({
 requestId:'guard-coin-request-'+id+'-0001',buyerAlias,
 spendUsdCents:10000,maximumBuyerTotalCents:10150,...extra,
});
const confirm=(guard,preview,extra={})=>guard.confirmSafePurchase({
 requestId:preview.requestId,quoteId:preview.quoteId,buyerAlias:preview.buyerAlias,
 acknowledgedBuyerTotalCents:preview.buyerTotalCents,
 acknowledgedCoinUnits:preview.coinUnits,acceptedTerms:true,
 acknowledgedDistinctRepeat:preview.duplicateRiskDetected,...extra,
});

test('100 USD a 10 centavos: 1000 Coin DEMO, $1.50 tarifa transparente',()=>{
 const {sale,guard}=make(),p=guard.previewSafePurchase(request());
 assert.equal(p.status,'terms_review_mock');
 assert.equal(p.coinUnits,'1000');
 assert.equal(p.spendUsdCents,10000);
 assert.equal(p.buyerTotalCents,'10150');
 assert.equal(p.feeTotalCents,'150');
 assert.equal(p.platformFeeCents,'105');
 assert.equal(p.partnerFeeCents,'45');
 assert.equal(p.priceVerifiedByExchange,false);
 assert.equal(p.realMoneyEnabled,false);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
 const bought=confirm(guard,p);
 assert.equal(bought.status,'simulated_sale_only');
 assert.equal(bought.actualSale,false);
 assert.equal(bought.companyDoesNotOwnCustomerUnits,true);
 assert.equal(bought.realMoneyEnabled,false);
 assert.equal(sale.inspectSyntheticBuyerBalance(p.buyerAlias).coinUnits,'1000');
 assert.equal(sale.getMockTreasuryReport().treasuryRemainingUnits,'999999000');
});

test('mismo requestId no vende dos veces ni vuelve a cobrar comisión',()=>{
 const {sale,guard}=make(),p=guard.previewSafePurchase(request('idem'));
 const a=confirm(guard,p);
 const b=confirm(guard,p);
 assert.equal(b.alreadyProcessed,true);
 assert.equal(a.purchaseId,b.purchaseId);
 assert.equal(guard.previewSafePurchase(request('idem')).purchaseId,a.purchaseId);
 assert.equal(sale.getMockTreasuryReport().illustrativePlatformFeeUsdCents,'105');
 assert.equal(guard.getSanitizedAudit().length,1);
});

test('una segunda compra similar avisa y exige consentimiento distinto',()=>{
 const {sale,guard}=make();
 const first=guard.previewSafePurchase(request('saleone'));
 const one=confirm(guard,first);
 const second=guard.previewSafePurchase(request('saletwo'));
 assert.equal(second.duplicateRiskDetected,true);
 assert.equal(second.priorMockPurchaseId,one.purchaseId);
 assert.throws(()=>confirm(guard,second,{acknowledgedDistinctRepeat:false}),/operación repetida/);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'1000');
 const two=confirm(guard,second);
 assert.equal(two.repeatPurchaseAcknowledged,true);
 assert.notEqual(two.purchaseId,one.purchaseId);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'2000');
});

test('si aparece otra compra entre cotización y confirmar, requiere nueva revisión',()=>{
 const {sale,guard}=make();
 const stale=guard.previewSafePurchase(request('stale'));
 const newOne=guard.previewSafePurchase(request('newone'));
 confirm(guard,newOne);
 assert.throws(()=>confirm(guard,stale),/revisar una nueva cotización/);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'1000');
});

test('al expirar la ventana de duplicados, nueva compra no requiere consentimiento especial',()=>{
 const {guard}=make();
 confirm(guard,guard.previewSafePurchase(request('earlier')));
 time+=600001;
 const fresh=guard.previewSafePurchase(request('later'));
 assert.equal(fresh.duplicateRiskDetected,false);
 assert.equal(confirm(guard,fresh).repeatPurchaseAcknowledged,false);
});

test('límite de gasto evita tarifas sorpresivas, datos privados y condiciones modificadas',()=>{
 const {sale,guard}=make();
 assert.throws(()=>guard.previewSafePurchase(request('limit','SIM-US-BUYER001',{
  maximumBuyerTotalCents:10000
 })),/supera el importe máximo/);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
 const p=guard.previewSafePurchase(request('normal'));
 for(const wrong of [
  {acknowledgedBuyerTotalCents:'10000'},{acknowledgedCoinUnits:'999'},
  {buyerAlias:'SIM-US-BUYER002'},{quoteId:'223e4567-e89b-42d3-a456-426614174000'}
 ])assert.throws(()=>confirm(guard,p,wrong),/No coinciden/);
 assert.throws(()=>confirm(guard,p,{acceptedTerms:false}),/aceptar/);
 assert.throws(()=>guard.previewSafePurchase({...request('pii'),cardNumber:'4111111111111111'}),/No se admiten/);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
});

test('si recibo de confirmación se pierde después del commit, sólo consultar',()=>{
 const {sale,guard}=make({overrideSale:sale=>Object.freeze({
  mode:'mock_only',realMoneyEnabled:false,liveTradingEnabled:false,
  previewPrimaryPurchase:i=>sale.previewPrimaryPurchase(i),
  confirmMockPrimaryPurchase:i=>{sale.confirmMockPrimaryPurchase(i);throw Error('respuesta perdida');},
  inspectMockPurchase:i=>sale.inspectMockPurchase(i)
 })});
 const p=guard.previewSafePurchase(request('lost'));
 const uncertain=confirm(guard,p);
 assert.equal(uncertain.status,'outcome_unverified_mock');
 assert.equal(uncertain.safeToSubmitAgain,false);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'1000');
 const stillPending=confirm(guard,p);
 assert.equal(stillPending.status,'outcome_unverified_mock');
 const recovered=guard.recoverWithoutResubmitting({
  requestId:p.requestId,buyerAlias:p.buyerAlias
 });
 assert.equal(recovered.status,'simulated_sale_only');
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'1000');
 assert.equal(guard.getSanitizedAudit().length,1);
});

test('falla ANTES de crear la compra: ausencia de recibo nunca autoriza reenviar',()=>{
 const {sale,guard}=make({overrideSale:sale=>Object.freeze({
  mode:'mock_only',realMoneyEnabled:false,liveTradingEnabled:false,
  previewPrimaryPurchase:i=>sale.previewPrimaryPurchase(i),
  confirmMockPrimaryPurchase:()=>{throw Error('sin red');},
  inspectMockPurchase:i=>sale.inspectMockPurchase(i)
 })});
 const p=guard.previewSafePurchase(request('noreply'));
 assert.equal(confirm(guard,p).status,'outcome_unverified_mock');
 assert.equal(guard.recoverWithoutResubmitting({
  requestId:p.requestId,buyerAlias:p.buyerAlias
 }).status,'not_observed_but_unresolved_mock');
 assert.throws(()=>guard.previewSafePurchase(request('different')),/sin resultado verificable/);
 assert.equal(sale.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
});

test('respuesta adulterada impide publicar compra como verificada',()=>{
 const {guard}=make({overrideSale:sale=>Object.freeze({
  mode:'mock_only',realMoneyEnabled:false,liveTradingEnabled:false,
  previewPrimaryPurchase:i=>sale.previewPrimaryPurchase(i),
  confirmMockPrimaryPurchase:i=>({...sale.confirmMockPrimaryPurchase(i),coinUnits:'9999'}),
  inspectMockPurchase:i=>({...sale.inspectMockPurchase(i),coinUnits:'9999'})
 })});
 const p=guard.previewSafePurchase(request('tamper'));
 assert.equal(confirm(guard,p).status,'inconsistent_response_mock');
 assert.equal(guard.recoverWithoutResubmitting({
  requestId:p.requestId,buyerAlias:p.buyerAlias
 }).status,'inconsistent_response_mock');
 assert.equal(guard.getSanitizedAudit().length,0);
});

test('las compras de distintos clientes no se confunden; precio de 25 centavos',()=>{
 const {guard}=make({config:{hypotheticalPriceUsdCents:25}});
 const a=guard.previewSafePurchase(request('a','SIM-US-BUYER001'));
 assert.equal(a.coinUnits,'400');
 const b=guard.previewSafePurchase(request('b','SIM-US-BUYER002'));
 assert.equal(b.duplicateRiskDetected,false);
 confirm(guard,a);
 assert.equal(confirm(guard,b).status,'simulated_sale_only');
 assert.throws(()=>guard.recoverWithoutResubmitting({
  requestId:a.requestId,buyerAlias:'SIM-US-BUYER002'
 }),/otra billetera/);
});

test('la condición de laboratorio y los parámetros permitidos se verifican',()=>{
 assert.throws(()=>createMockCoinPurchaseGuard({primarySale:{mode:'live'}}),/BLOQUEADAS/);
 const {guard}=make();
 assert.throws(()=>guard.previewSafePurchase(request('bad','customer@gmail.com')),/alias sintéticos/);
 assert.throws(()=>guard.previewSafePurchase(request('x','SIM-US-BUYER001',{
  maximumBuyerTotalCents:0
 })),/inválida/);
 assert.throws(()=>guard.confirmSafePurchase({
  requestId:'unknown-request-0001',bankAccount:'00000'
 }),/No se admiten/);
});
