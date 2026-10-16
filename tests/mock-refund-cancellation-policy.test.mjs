import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMockRefundCancellation,DEMO_REFUND_STATES} from '../src/admin/mock-refund-cancellation-policy.mjs';
test('solamente pre-fondeo cancela, sólo fondeo o pago fallido solicita devolución ficticia',()=>{
 assert.equal(DEMO_REFUND_STATES.length,9);
 for(const state of DEMO_REFUND_STATES){
  const row=assessMockRefundCancellation(state);
  assert.equal(row.canCancelUnfundedDemo,state==='created_mock');
  assert.equal(row.canRequestRefundDemo,['funded_mock','payout_failed_mock'].includes(state));
  assert.equal(row.realMoneyEnabled,false);assert.equal(row.canApproveRealRefund,false);
  assert.equal(row.actualRefundConfirmed,false);assert.equal(row.canPostLedger,false);
 }
});
test('pago pendiente y pago completado requieren intervención, no devolución automática',()=>{
 for(const state of ['paid_mock','payout_pending_mock','refund_failed_mock']){
  const r=assessMockRefundCancellation(state);
  assert.equal(r.humanReviewNeeded,true);
  assert.equal(r.canCancelUnfundedDemo,false);
  assert.equal(r.canRequestRefundDemo,false);
 }
});
test('estados arbitrarios del cliente no cambian reglas',()=>{
 assert.throws(()=>assessMockRefundCancellation('paid_real'),/desconocido/);
 assert.throws(()=>assessMockRefundCancellation(null),/desconocido/);
});
