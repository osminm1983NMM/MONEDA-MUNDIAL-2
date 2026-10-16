import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeRemittanceMonitor} from '../src/admin/remittance-monitor-demo.mjs';
const example={order_id:'11111111-1111-4111-8111-111111111111',
 source_country:'US',destination_country:'NI',amount_cents:10000,order_status:'simulated',
 event_count:3,assignment_status:'planned',pickup_status:'locked',failed_attempts:5,
 anomaly_count:2,attention:'review',identity_demo_checked:false,real_payments_enabled:false};
test('resumen de riesgos ficticios sin permisos de pago',()=>{
 const x=summarizeRemittanceMonitor([example,{...example,order_id:'22222222-2222-4222-8222-222222222222',
  pickup_status:'expired',attention:'expired',failed_attempts:0,anomaly_count:0}]);
 assert.equal(x.total,2);assert.equal(x.needsReview,1);assert.equal(x.expired,1);
 assert.ok(x.rows.every(r=>!r.canPay&&!r.realPaymentsEnabled));
});
test('datos manipulados por cliente no activan supervisión de dinero real',()=>{
 assert.throws(()=>summarizeRemittanceMonitor([{...example,real_payments_enabled:true}]));
 assert.throws(()=>summarizeRemittanceMonitor([{...example,failed_attempts:6}]));
 assert.throws(()=>summarizeRemittanceMonitor([{...example,amount_cents:-1}]));
 assert.deepEqual(summarizeRemittanceMonitor().rows,[]);
});
