import test from 'node:test';import assert from 'node:assert/strict';
import {previewRemittanceDisclosure as preview} from '../src/digital-money/remittance-disclosure-demo.mjs';
test('HN muestra comisión solamente hipotética y tarifa final desconocida',()=>{
 const x=preview({destination:'HN',hypotheticalUsdCents:10000,manualLocalPerUsd:'25.125'});
 assert.equal(x.principalUsdCents,10000);assert.equal(x.hypotheticalServiceFeeUsdCents,110);
 assert.equal(x.hypotheticalDisplayedTotalUsdCents,10110);
 assert.equal(x.recipientAmountManualIllustration,'2512.50');
 assert.equal(x.totalCostComplete,false);assert.equal(x.recipientAmountGuaranteed,false);
 assert.equal(x.canSend,false);
});
test('sin tasa verificable no se inventa una cantidad de moneda local',()=>{
 const x=preview({destination:'NI',hypotheticalUsdCents:10000});
 assert.equal(x.recipientAmountManualIllustration,null);
 assert.equal(x.fxProviderQuoteAvailable,false);
 assert.equal(x.realPaymentsEnabled,false);
});
test('saldo DEMO y conceptos cripto jamás producen costos o valor en USD',()=>{
 for(const source of ['demo_wallet','coin_concept','digital_concept']){
  const x=preview({source,destination:'HN',manualLocalPerUsd:'25.1'});
  assert.equal(x.principalUsdCents,null);assert.equal(x.hypotheticalDisplayedTotalUsdCents,null);
  assert.equal(x.recipientAmountManualIllustration,null);
  assert.equal(x.canDebitWallet,false);
 }
});
test('rechaza rutas e importes inválidos y bloquea transferencia real',()=>{
 assert.equal(preview({destination:'ZZ'}),null);
 assert.equal(preview({hypotheticalUsdCents:0}),null);
 const x=preview({destination:'EC'});
 assert.equal(x.recipientAmountGuaranteed,false);
 assert.equal(x.customerDisclosureApproved,false);
});
