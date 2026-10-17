import test from 'node:test';
import assert from 'node:assert/strict';
import {DIGITAL_ASSET_DESIGNS,assessDigitalMoneyDesign,compareInternationalPriceDemo} from '../src/digital-money/design-and-comparison.mjs';
test('dos modelos futuros y saldo MWD de demostración están aislados',()=>{
 assert.equal(DIGITAL_ASSET_DESIGNS.length,3);
 assert.ok(DIGITAL_ASSET_DESIGNS.every(x=>x.canBuy===false&&x.canSell===false));
 assert.equal(assessDigitalMoneyDesign().variableTokenPriceUsd,null);
 assert.equal(assessDigitalMoneyDesign().variableTokenIssued,false);
 assert.equal(assessDigitalMoneyDesign().ledgerLinkedToDemoWallet,false);
});
test('precio de tomates: diferencia surge de cotización manual, no de cambiar unidad',()=>{
 const q=compareInternationalPriceDemo({
  localCurrency:'PEN',localPrice:'10.00',localUnitsPerUsd:'3.636364',
  sellerUsd:'3.00',tokenUsdExample:'1.00'
 });
 assert.equal(q.referenceUsdCents,275);
 assert.equal(q.sellerUsdCents,300);
 assert.equal(q.differenceUsdCents,25);
 assert.equal(q.hypotheticalCoinUnits,2.75);
 assert.equal(q.guaranteedSavingsCents,null);
 assert.equal(q.marketPriceVerified,false);
 assert.equal(q.merchantAccepted,false);
});
test('a 0.10 USD hipotéticos la cantidad de unidades es 27.5, precio no aprobado',()=>{
 const q=compareInternationalPriceDemo({localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'3.636364',sellerUsd:'3',tokenUsdExample:'0.10'});
 assert.equal(q.hypotheticalCoinUnits,27.5);
 assert.equal(q.canBuyTokens,false);
 assert.equal(q.canIssueCoin,false);
});
test('cotización manual jamás constituye tipo de cambio oficial ni garantía de ahorro',()=>{
 const q=compareInternationalPriceDemo({localCurrency:'HNL',localPrice:'100',localUnitsPerUsd:'25',sellerUsd:'3'});
 assert.equal(q.differenceUsdCents,-100);
 assert.equal(q.totalToPayCents,null);
 assert.equal(q.exchangeRateVerified,false);
});
test('impide tasas faltantes, inválidas, divisas falsas e importes peligrosos',()=>{
 for(const payload of [
 {localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'0',sellerUsd:'3'},
 {localCurrency:'USD',localPrice:'10',localUnitsPerUsd:'3',sellerUsd:'3'},
 {localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'3',sellerUsd:'-3'},
 {localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'3',sellerUsd:'3',tokenUsdExample:'0'},
 {localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'3',sellerUsd:'3',tokenUsdExample:'abc'},
 ]) assert.equal(compareInternationalPriceDemo(payload),null);
});

test('redondeo de centavos exacto en tasa manual y comparación sin dinero real',()=>{
 const a=compareInternationalPriceDemo({localCurrency:'PEN',localPrice:'1.00',localUnitsPerUsd:'8',sellerUsd:'1.00'});
 assert.equal(a.referenceUsdCents,13); // 12.5 centavos, mitad hacia arriba.
 const b=compareInternationalPriceDemo({localCurrency:'PEN',localPrice:'1.00',localUnitsPerUsd:'40',sellerUsd:'1.00'});
 assert.equal(b.referenceUsdCents,3); // 2.5 centavos.
 const c=compareInternationalPriceDemo({localCurrency:'PEN',localPrice:'10',localUnitsPerUsd:'3.636364',sellerUsd:'3',tokenUsdExample:'0.10'});
 assert.equal(c.referenceUsdCents,275);
 assert.equal(c.hypotheticalCoinUnits,27.5);
 assert.equal(c.canSendMoney,false);
 assert.equal(c.guaranteedSavingsCents,null);
});
test('referencia mínima por debajo de medio centavo se rechaza',()=>{
 assert.equal(compareInternationalPriceDemo({localCurrency:'PEN',localPrice:'0.01',localUnitsPerUsd:'100',sellerUsd:'1'}),null);
});
