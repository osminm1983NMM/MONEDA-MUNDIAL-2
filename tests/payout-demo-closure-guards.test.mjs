import test from 'node:test';
import assert from 'node:assert/strict';
import {canCloseMockPayout,isSafeMockPayoutClosureResponse} from '../src/payout-demo-closure-guards.mjs';

const ready={orderStatus:'simulated',assignmentStatus:'planned',
  codeStatus:'consumed',identityCheckSimulated:true};
test('UI DEMO only permits mock closure when code was consumed and simulated identity check exists',()=>{
  assert.equal(canCloseMockPayout(ready),true);
  for(const codeStatus of ['not_issued','active','cancelled','locked','expired',null,undefined]){
    assert.equal(canCloseMockPayout({...ready,codeStatus}),false);
  }
  for(const assignmentStatus of ['unassigned','sample_completed',null]){
    assert.equal(canCloseMockPayout({...ready,assignmentStatus}),false);
  }
  assert.equal(canCloseMockPayout({...ready,identityCheckSimulated:false}),false);
  assert.equal(canCloseMockPayout({...ready,orderStatus:'review'}),false);
  assert.equal(canCloseMockPayout(),false);
});
test('UI DEMO rejects any ambiguous or real-money response',()=>{
  const response={status:'sample_completed',real_payments_enabled:false,
    redeemable:false,money_paid:false};
  assert.equal(isSafeMockPayoutClosureResponse(response),true);
  for(const key of ['real_payments_enabled','redeemable','money_paid']){
    assert.equal(isSafeMockPayoutClosureResponse({...response,[key]:true}),false);
    const missing={...response};delete missing[key];
    assert.equal(isSafeMockPayoutClosureResponse(missing),false);
  }
  assert.equal(isSafeMockPayoutClosureResponse({status:'pending',...response,status:'processing'}),false);
  assert.equal(isSafeMockPayoutClosureResponse(null),false);
});
