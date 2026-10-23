import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockCoinPrimarySale} from '../src/digital-money/mock-coin-primary-sale.mjs';

let now=1800000000000;
const config={mode:'mock',maximumSupplyUnits:'1000000000',
 treasuryInventoryUnits:'1000000000',hypotheticalPriceUsdCents:10,
 feeBps:150,partnerFeeShareBps:3000};
const make=(patch={})=>{
 now=1800000000000;
 return createMockCoinPrimarySale({clock:()=>now,config:{...config,...patch}});
};
const input=(requestId='example-request-0001',buyerAlias='SIM-US-BUYER001',
 spendUsdCents=10000)=>({requestId,buyerAlias,spendUsdCents});
const purchase=(m,req=input())=>{
 const q=m.previewPrimaryPurchase(req);
 return m.confirmMockPrimaryPurchase({quoteId:q.quoteId,
  requestId:req.requestId,buyerAlias:req.buyerAlias,acceptedIllustrativeTerms:true});
};

test('1,000 millones iniciales; compra ficticia de $100 a $0.10 = 1,000 Coin',()=>{
 const m=make(),i=input(),q=m.previewPrimaryPurchase(i);
 assert.equal(q.coinUnits,'1000');
 assert.equal(q.feeCents,'150');
 assert.equal(q.partnerFeeCents,'45');
 assert.equal(q.platformFeeCents,'105');
 assert.equal(q.buyerTotalUsdCents,'10150');
 assert.equal(q.tokensIssued,false);
 assert.equal(q.paymentReceived,false);
 const r=m.confirmMockPrimaryPurchase({
  quoteId:q.quoteId,requestId:i.requestId,buyerAlias:i.buyerAlias,
  acceptedIllustrativeTerms:true
 });
 assert.equal(r.coinUnits,'1000');
 assert.equal(r.illustrativeIssuerGrossSaleCents,10000);
 assert.equal(r.illustrativePlatformFeeCents,'105');
 assert.equal(r.illustrativePartnerFeeCents,'45');
 assert.equal(r.usdReceived,false);
 assert.equal(r.realMoneyEnabled,false);
 assert.equal(m.inspectSyntheticBuyerBalance(i.buyerAlias).coinUnits,'1000');
 const report=m.getMockTreasuryReport();
 assert.equal(report.treasuryRemainingUnits,'999999000');
 assert.equal(report.soldToSyntheticBuyersUnits,'1000');
 assert.equal(report.issuerGrossIsNetProfit,false);
 assert.equal(report.companyOwnsBuyerUnits,false);
});

test('precio de 25 centavos entrega 400 Coin por $100 antes de comisiones',()=>{
 const m=make({hypotheticalPriceUsdCents:25});
 assert.equal(m.previewPrimaryPurchase(input()).coinUnits,'400');
});

test('cotización y recibo idempotentes no duplican compras ni comisiones',()=>{
 const m=make(),i=input();
 const q=m.previewPrimaryPurchase(i);
 assert.equal(m.previewPrimaryPurchase(i).quoteId,q.quoteId);
 const r=purchase(m,i);
 const again=m.confirmMockPrimaryPurchase({quoteId:q.quoteId,requestId:i.requestId,
  buyerAlias:i.buyerAlias,acceptedIllustrativeTerms:true});
 assert.equal(again.alreadyProcessed,true);
 assert.equal(again.purchaseId,r.purchaseId);
 assert.equal(m.inspectMockPurchase({requestId:i.requestId,buyerAlias:i.buyerAlias}).purchaseId,r.purchaseId);
 assert.equal(m.getMockTreasuryReport().treasuryRemainingUnits,'999999000');
 assert.equal(m.getMockTreasuryReport().illustrativePlatformFeeUsdCents,'105');
 assert.equal(m.sanitizedMockAudit().length,1);
});

test('intento reutilizado con otro comprador, importe o previsualización se rechaza',()=>{
 const m=make(),i=input(),q=m.previewPrimaryPurchase(i);
 assert.throws(()=>m.previewPrimaryPurchase({...i,spendUsdCents:20000}),/diferente/);
 assert.throws(()=>m.previewPrimaryPurchase({...i,buyerAlias:'SIM-US-BUYER002'}),/diferente/);
 assert.throws(()=>m.confirmMockPrimaryPurchase({quoteId:q.quoteId,requestId:i.requestId,
  buyerAlias:'SIM-US-BUYER002',acceptedIllustrativeTerms:true}),/no coincide/);
 assert.throws(()=>m.confirmMockPrimaryPurchase({quoteId:'223e4567-e89b-42d3-a456-426614174000',requestId:i.requestId,
  buyerAlias:i.buyerAlias,acceptedIllustrativeTerms:true}),/no coincide/);
 assert.equal(m.inspectMockPurchase({requestId:i.requestId,buyerAlias:i.buyerAlias}),null);
 assert.equal(m.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
});

test('si caduca no puede vender, aun cuando se reenvíe con misma requestId',()=>{
 const m=make(),i=input(),q=m.previewPrimaryPurchase(i);
 now+=120000;
 assert.throws(()=>m.confirmMockPrimaryPurchase({quoteId:q.quoteId,
  requestId:i.requestId,buyerAlias:i.buyerAlias,acceptedIllustrativeTerms:true}),/vencida/);
 const old=m.previewPrimaryPurchase(i);
 assert.equal(old.quoteExpired,true);
 assert.equal(old.quoteId,q.quoteId);
 assert.equal(m.getMockTreasuryReport().soldToSyntheticBuyersUnits,'0');
});

test('previsualizaciones sin reservar inventario no pueden causar ventas superiores a la tesorería',()=>{
 const m=make({maximumSupplyUnits:'1000',treasuryInventoryUnits:'1000'});
 const a=input('sale-first-req-0001'),b=input('sale-second-req-0001');
 const qa=m.previewPrimaryPurchase(a),qb=m.previewPrimaryPurchase(b);
 assert.equal(qa.coinUnits,'1000');
 assert.equal(qb.coinUnits,'1000');
 purchase(m,a);
 assert.throws(()=>m.confirmMockPrimaryPurchase({quoteId:qb.quoteId,requestId:b.requestId,
  buyerAlias:b.buyerAlias,acceptedIllustrativeTerms:true}),/inventario/);
 assert.equal(m.getMockTreasuryReport().treasuryRemainingUnits,'0');
 assert.equal(m.getMockTreasuryReport().soldToSyntheticBuyersUnits,'1000');
});

test('no vende fondos ajenos: dinero, saldo de Coin y comisiones siguen separados',()=>{
 const m=make();
 const r1=purchase(m,input('distinct-req-0001','SIM-US-BUYER001'));
 const r2=purchase(m,input('distinct-req-0002','SIM-US-BUYER002'));
 assert.notEqual(r1.purchaseId,r2.purchaseId);
 assert.equal(m.inspectSyntheticBuyerBalance('SIM-US-BUYER001').coinUnits,'1000');
 assert.equal(m.inspectSyntheticBuyerBalance('SIM-US-BUYER002').coinUnits,'1000');
 assert.throws(()=>m.inspectMockPurchase({
  requestId:'distinct-req-0001',buyerAlias:'SIM-US-BUYER002'
 }),/cruzada/);
 assert.equal(m.getMockTreasuryReport().illustrativeIssuerGrossSaleUsdCents,'20000');
 assert.equal(m.getMockTreasuryReport().illustrativePlatformFeeUsdCents,'210');
 assert.equal(m.getMockTreasuryReport().illustrativePartnerFeeUsdCents,'90');
 assert.equal(m.inspectSyntheticBuyerBalance('SIM-US-BUYER001').sellerCanUnilaterallyClawBack,false);
});

test('ninguna cuota de socio es un pago real ni toda venta es utilidad',()=>{
 const m=make({partnerFeeShareBps:10000});
 const r=purchase(m);
 assert.equal(r.illustrativePartnerFeeCents,'150');
 assert.equal(r.illustrativePlatformFeeCents,'0');
 assert.equal(r.partnerActuallyPaid,false);
 assert.equal(r.issuerGrossIsNetProfit,false);
 assert.equal(m.getMockTreasuryReport().tokensIssued,false);
 assert.equal(m.getMockTreasuryReport().realMoneyEnabled,false);
});

test('rechaza modo live, campos secretos, fracciones, cambios arbitrarios y cantidades no divisibles',()=>{
 assert.throws(()=>make({mode:'live'}),/prohíbe vender Coin real/);
 assert.throws(()=>make({treasuryInventoryUnits:'1000000001'}),/inválidos/);
 assert.throws(()=>make({partnerFeeShareBps:10001}),/inválidos/);
 const m=make({hypotheticalPriceUsdCents:25});
 assert.throws(()=>m.previewPrimaryPurchase(input('not-divisible-0001','SIM-US-BUYER001',10001)),/múltiplo/);
 assert.throws(()=>m.previewPrimaryPurchase({...input('pii-extra-request-001'),cardNumber:'4111111111111111'}),/múltiplo|sintéticos|inválida/);
 assert.throws(()=>m.confirmMockPrimaryPurchase({...input(),quoteId:'none'}),/inválida/);
 assert.equal(m.getMockTreasuryReport().tokensIssued,false);
});
