import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMockOperationRisk} from '../src/server/mock-risk-monitor.mjs';
const base={orderStatus:'payout_pending_mock',amountCents:10000};
test('sin alertas no autoriza transferencias ni declara seguridad real',()=>{
 const x=evaluateMockOperationRisk(base);
 assert.equal(x.humanReviewRequired,false);
 assert.equal(x.realMoneyEnabled,false);
 assert.equal(x.automaticallyApproveRealFunds,false);
});
test('duplicación, conciliación y retraso generan revisión humana',()=>{
 const x=evaluateMockOperationRisk({...base,duplicateEventCount:2,
 unmatchedStatementCount:1,minutesPending:1440});
 assert.equal(x.humanReviewRequired,true);
 assert.equal(x.signals.length,3);
 assert.equal(x.fraudDetermined,false);
 assert.equal(x.automatedBankAction,false);
});
test('reembolsos reiterados y fallo de desembolso requieren investigación',()=>{
 const x=evaluateMockOperationRisk({orderStatus:'payout_failed_mock',
 amountCents:10000,refundAttempts:3});
 assert.ok(x.signals.includes('refund_attempts_review_mock'));
 assert.ok(x.signals.includes('failed_payout_review_mock'));
});
test('rechaza importes, estados y conteos no válidos',()=>{
 assert.throws(()=>evaluateMockOperationRisk({...base,amountCents:-1}),/inválidos/);
 assert.throws(()=>evaluateMockOperationRisk({...base,orderStatus:'paid_real'}),/inválidos/);
 assert.throws(()=>evaluateMockOperationRisk({...base,duplicateEventCount:-1}),/inválidos/);
});
