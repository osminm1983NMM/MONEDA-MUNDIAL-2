import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockCoinDigitalSettlement} from '../src/digital-money/mock-coin-digital-settlement.mjs';

const secretFixture={demo_user:{coin:'100',digital:'0'},demo_pool:{coin:'0',digital:'100'}};
let t=1800000000000;
const make=()=>createMockCoinDigitalSettlement({clock:()=>t,balancesFixture:secretFixture});
test('consulta de reserva por solicitud evita un segundo débito ficticio tras respuesta perdida',()=>{
 t=1800000000000;
 const m=make(),q=m.createScenarioQuote({fromAsset:'coin',fromUnits:'10',toUnits:'25'});
 const reservation=m.reserveScenario({quoteId:q.quoteId,requestId:'conversion-attempt-recovery-001'});
 // Simular pérdida del recibo inicial: solo consultar por el mismo requestId.
 const found=m.getDemoReservationByRequest({requestId:'conversion-attempt-recovery-001'});
 assert.equal(found.operationId,reservation.operationId);
 assert.equal(found.status,'reserved');
 assert.equal(found.realSettlement,false);
 assert.equal(m.inspectDemoBalance().coinUnits,'100');
 assert.equal(m.inspectDemoBalance().availableCoinUnits,'90');
 const settled=m.finalizeScenario({operationId:found.operationId,requestId:'conversion-finalize-recovery-001'});
 assert.equal(settled.status,'simulated_completed');
 assert.equal(m.getDemoReservationByRequest({requestId:'conversion-attempt-recovery-001'}).status,'simulated_completed');
 assert.equal(m.inspectDemoBalance().coinUnits,'90');
 assert.equal(m.inspectDemoBalance().digitalUnits,'25');
 assert.equal(m.auditEvents().filter(e=>e.type==='reserved').length,1);
 assert.equal(m.auditEvents().filter(e=>e.type==='simulated_completed').length,1);
});
test('sin resultado no se presume que no haya habido operación ni se emite moneda',()=>{
 t=1800000000000;
 const m=make();
 assert.equal(m.getDemoReservationByRequest({requestId:'unknown-request-12345'}),null);
 assert.equal(m.inspectDemoBalance().actualCustomerFunds,false);
 assert.equal(m.canTradeRealAssets,false);
});
test('una reserva vencida sigue inspeccionable pero no vuelve a completarse',()=>{
 t=1800000000000;
 const m=make(),q=m.createScenarioQuote({fromAsset:'coin',fromUnits:'10',toUnits:'25'});
 const op=m.reserveScenario({quoteId:q.quoteId,requestId:'expired-reserve-lookup-001'});
 t+=61000;
 const found=m.getDemoReservationByRequest({requestId:'expired-reserve-lookup-001'});
 assert.equal(found.status,'expired');
 assert.equal(m.inspectDemoBalance().availableCoinUnits,'100');
 assert.throws(()=>m.finalizeScenario({operationId:op.operationId,requestId:'late-finish-attempt-001'}),/no admite/);
});
test('claves no válidas y cuentas inexistentes se rechazan sin exponer información',()=>{
 t=1800000000000;
 const m=make();
 assert.throws(()=>m.getDemoReservationByRequest({requestId:'x'}),/Solicitud/);
 assert.throws(()=>m.getDemoReservationByRequest({requestId:'valid-request-12345',userId:'real-user'}),/ficticia/);
});
