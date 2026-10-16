import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretMockProviderEvent} from '../src/server/mock-provider-event-mapper.mjs';
const payload={eventId:'event-sample-12345',orderId:'order-sample-12345',country:'HN',currency:'USD',amountCents:10000,status:'payout_settled_mock'};
test('pago no se confunde con fondos recibidos',()=>{
 const x=interpretMockProviderEvent({provider:'future_regulated_provider_alpha',payload,authenticated:true});
 assert.equal(x.isFundingSettlement,false);
 assert.equal(x.isPayoutSettlement,true);
 assert.equal(x.balanceCreditAllowed,false);
 assert.equal(x.realSignatureVerified,false);
});
test('fondeo, salida y devolución separados, incluyendo Nicaragua',()=>{
 for(const [status,field] of [
  ['funding_settled_mock','isFundingSettlement'],
  ['payout_settled_mock','isPayoutSettlement'],
  ['refund_settled_mock','isRefundSettlement']
 ]){
  const x=interpretMockProviderEvent({provider:'future_regulated_provider_beta',payload:{...payload,country:'NI',status},authenticated:true});
  assert.equal(x[field],true);assert.equal(x.realMoneyEnabled,false);
 }
});
test('rechaza proveedores no integrados, eventos ajenos y producción',()=>{
 const call=x=>interpretMockProviderEvent({provider:'future_regulated_provider_alpha',payload,authenticated:true,...x});
 assert.throws(()=>call({mode:'production'}),/deshabilitada/);
 assert.throws(()=>call({authenticated:false}),/autenticidad/);
 assert.throws(()=>call({provider:'TerraPay'}),/no integrado/);
 assert.throws(()=>call({payload:{...payload,country:'ZZ'}}),/no válido/);
 assert.throws(()=>call({payload:{...payload,status:'completed'}}),/no válido/);
 assert.throws(()=>call({payload:{...payload,bankAccount:'123'}}),/no válido/);
});
