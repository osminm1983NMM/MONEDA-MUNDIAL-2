import test from 'node:test';
import assert from 'node:assert/strict';
import {previewManualFxPayout} from '../src/digital-money/wallet-remittance-preview.mjs';

test('escenario HN con tasa manual muestra valor sin cotización bancaria',()=>{
 const v=previewManualFxPayout({destination:'HN',hypotheticalUsdCents:10000,manualLocalPerUsd:'25.125'});
 assert.equal(v.illustrativeRecipientAmount,'2512.50');
 assert.equal(v.exampleSourceAmountCents,10000);
 assert.equal(v.destinationCurrency,'HNL');
 assert.equal(v.fxRateVerified,false);
 assert.equal(v.canSend,false);
 assert.equal(v.recipientAmountGuaranteed,false);
 assert.equal(v.realPaymentsEnabled,false);
});
test('Nicaragua sigue contemplada y no tiene corredor operativo',()=>{
 const v=previewManualFxPayout({destination:'NI',hypotheticalUsdCents:10000,manualLocalPerUsd:'36.5'});
 assert.equal(v.illustrativeRecipientAmount,'3650.00');
 assert.equal(v.canDisburse,false);
});
test('redondeo de divisas ficticias sin pérdida por punto flotante',()=>{
 const v=previewManualFxPayout({destination:'PE',hypotheticalUsdCents:12345,manualLocalPerUsd:'3.123456'});
 assert.equal(v.illustrativeRecipientAmount,'385.59');
 assert.equal(v.feeComplete,false);
});
test('rechazar tasas defectuosas y ninguna valorización de créditos o cripto',()=>{
 for(const value of ['', '0', '0.000000', '-1', '1e2', '1.1234567', '1..2', '01', 'NaN', 25, '1/2']){
  assert.equal(previewManualFxPayout({manualLocalPerUsd:value}),null,String(value));
 }
 for(const source of ['demo_wallet','coin_concept','digital_concept']){
  assert.equal(previewManualFxPayout({source,manualLocalPerUsd:'25'}),null);
 }
 assert.equal(previewManualFxPayout({destination:'EC',manualLocalPerUsd:'1'}),null);
 assert.equal(previewManualFxPayout({destination:'HN',hypotheticalUsdCents:99,manualLocalPerUsd:'25'}),null);
});
