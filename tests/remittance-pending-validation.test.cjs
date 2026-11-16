const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePendingRemittance } = require('../remittancePendingValidation');
const userId = 'a1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const otherUser = 'b1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const requestId = 'c1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const orderId = 'd1198c2b-59bb-49c5-9a7e-1a2c3d4e5f60';
const base = { version:1,userId,requestId,createdAt:'2026-11-16T21:00:00.000Z' };
const create = { ...base,kind:'create',destination:'HN',cents:10000 };
const transition = { ...base,kind:'transition',orderId,next:'review',from:'draft' };

test('accepts a valid create and returns only approved fields', () => {
  assert.deepEqual(validatePendingRemittance({...create,unexpected:'discard'},userId),create);
});
test('accepts an allowed transition', () => {
  const {from,...expected}=transition;
  assert.deepEqual(validatePendingRemittance(transition,userId),expected);
});
test('rejects other users and malformed user ids', () => {
  assert.equal(validatePendingRemittance(create,otherUser),null);
  assert.equal(validatePendingRemittance(create,'not-a-user'),null);
});
test('rejects corrupt, non-v4 and missing identifiers', () => {
  assert.equal(validatePendingRemittance(null,userId),null);
  assert.equal(validatePendingRemittance({...create,requestId:'invalid'},userId),null);
  assert.equal(validatePendingRemittance({...transition,orderId:'invalid'},userId),null);
});
test('rejects invalid amounts, destinations and extra conflicting parameters', () => {
  for (const cents of [0,99,10000001,1.5,NaN,'100']) assert.equal(validatePendingRemittance({...create,cents},userId),null);
  assert.equal(validatePendingRemittance({...create,destination:'US'},userId),null);
  assert.equal(validatePendingRemittance({...create,next:'review'},userId),null);
});
test('rejects invalid transitions and contradictory source states', () => {
  assert.equal(validatePendingRemittance({...transition,next:'simulated'},userId),null);
  assert.equal(validatePendingRemittance({...transition,from:'review',next:'review'},userId),null);
  assert.equal(validatePendingRemittance({...transition,next:'paid'},userId),null);
});
test('rejects invalid versions, timestamps and unknown operations', () => {
  assert.equal(validatePendingRemittance({...create,version:2},userId),null);
  assert.equal(validatePendingRemittance({...create,createdAt:'invalid'},userId),null);
  assert.equal(validatePendingRemittance({...create,kind:'withdraw'},userId),null);
});
