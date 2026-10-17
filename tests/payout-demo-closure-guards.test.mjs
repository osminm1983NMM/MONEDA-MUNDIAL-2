import test from 'node:test';
import assert from 'node:assert/strict';
import {canCloseMockPayout,isSafeMockPayoutClosureResponse,isVerifiedMockPayoutCapability} from '../src/payout-demo-closure-guards.mjs';

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

test('server capability must be explicitly confirmed before mock closure',()=>{
 const good={version:1,demo_only:true,closure_requires_consumed_code:true,real_payments_enabled:false};
 assert.equal(isVerifiedMockPayoutCapability(good),true);
 for(const bad of [null,undefined,{},[],{...good,version:2},
 {...good,demo_only:false},{...good,closure_requires_consumed_code:false},
 {...good,real_payments_enabled:true}]){
   assert.equal(isVerifiedMockPayoutCapability(bad),false);
 }
});
