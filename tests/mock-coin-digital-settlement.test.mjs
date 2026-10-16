import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockCoinDigitalSettlement} from '../src/digital-money/mock-coin-digital-settlement.mjs';
let now=1700000000000;
function setup(fixture={demo_user:{coin:'100',digital:'0'},demo_pool:{coin:'0',digital:'100'}}){
 now=1700000000000;
 return createMockCoinDigitalSettlement({clock:()=>now,balancesFixture:fixture});
}
function reserve(m,id='request-reserve-001'){
 const q=m.createScenarioQuote({fromAsset:'coin',fromUnits:'10',toUnits:'25'});
 return {quote:q,order:m.reserveScenario({quoteId:q.quoteId,requestId:id})};
}
test('no hay modo live ni saldos reales ni precios reales',()=>{
 assert.throws(()=>createMockCoinDigitalSettlement({mode:'live',balancesFixture:{demo_user:{coin:'1',digital:'1'},demo_pool:{coin:'1',digital:'1'}}}),/bloqueado/);
 const m=setup();assert.equal(m.canTradeRealAssets,false);
 assert.equal(m.inspectDemoBalance().actualCustomerFunds,false);
 assert.equal(m.inspectDemoBalance().actualMarketPrice,null);
});
test('retiene únicamente liquidez ficticia y finaliza conservando unidades',()=>{
 const m=setup(),{quote,order}=reserve(m);
 assert.equal(quote.priceVerified,false);
 assert.equal(m.inspectDemoBalance().availableCoinUnits,'90');
 const done=m.finalizeScenario({operationId:order.operationId,requestId:'request-finalize-001'});
 assert.equal(done.status,'simulated_completed');
 assert.equal(done.realSettlement,false);
 assert.equal(m.inspectDemoBalance().coinUnits,'90');
 assert.equal(m.inspectDemoBalance().digitalUnits,'25');
 assert.equal(m.inspectDemoBalance('demo_pool').coinUnits,'10');
 assert.equal(m.inspectDemoBalance('demo_pool').digitalUnits,'75');
 assert.equal(m.finalizeScenario({operationId:order.operationId,requestId:'request-finalize-001'}).alreadyProcessed,true);
 assert.throws(()=>m.finalizeScenario({operationId:order.operationId,requestId:'request-finalize-002'}),/no admite/);
});
test('idempotencia y reservas evitan doble gasto',()=>{
 const m=setup(),{quote,order}=reserve(m);
 assert.equal(m.reserveScenario({quoteId:quote.quoteId,requestId:'request-reserve-001'}).operationId,order.operationId);
 assert.throws(()=>m.reserveScenario({quoteId:'invalid',requestId:'request-reserve-001'}),/reutilizada/);
 assert.throws(()=>m.reserveScenario({quoteId:quote.quoteId,requestId:'request-reserve-002'}),/consumida/);
 const second=m.createScenarioQuote({fromAsset:'coin',fromUnits:'95',toUnits:'1'});
 assert.throws(()=>m.reserveScenario({quoteId:second.quoteId,requestId:'request-reserve-003'}),/Saldo/);
});
test('cancelación libera reservas sin crear unidades',()=>{
 const m=setup(),{order}=reserve(m);
 const cancelled=m.cancelScenario({operationId:order.operationId,requestId:'request-cancel-001'});
 assert.equal(cancelled.status,'cancelled');
 assert.equal(m.inspectDemoBalance().availableCoinUnits,'100');
 assert.equal(m.inspectDemoBalance().digitalUnits,'0');
 assert.throws(()=>m.finalizeScenario({operationId:order.operationId,requestId:'request-finalize-001'}),/no admite/);
});
test('expiración del bloqueo impide liquidación tardía y devuelve disponibilidad',()=>{
 const m=setup(),{order}=reserve(m);
 now+=61000;
 assert.equal(m.getDemoOperation(order.operationId).status,'expired');
 assert.equal(m.inspectDemoBalance().availableCoinUnits,'100');
 assert.throws(()=>m.finalizeScenario({operationId:order.operationId,requestId:'request-finalize-001'}),/no admite/);
});
test('rechaza liquidez insuficiente y grandes saldos no factibles',()=>{
 const m=setup();
 const q=m.createScenarioQuote({fromAsset:'coin',fromUnits:'10',toUnits:'101'});
 assert.throws(()=>m.reserveScenario({quoteId:q.quoteId,requestId:'request-reserve-001'}),/Liquidez/);
 assert.throws(()=>m.createScenarioQuote({fromAsset:'coin',fromUnits:'0',toUnits:'2'}),/positivas/);
 assert.throws(()=>m.createScenarioQuote({fromAsset:'foo',fromUnits:'10',toUnits:'2'}),/Activo/);
});
