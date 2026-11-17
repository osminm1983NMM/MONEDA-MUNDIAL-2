'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function setup() {
  const state = { payer: 1000, merchant: 0, status: 'pending', operationCount: 0 };
  let queue = Promise.resolve();
  const serialize = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  return {
    state,
    pay: () => serialize(() => {
      if (state.status === 'paid') return 'already_processed';
      if (state.status !== 'pending') throw Error('unavailable');
      if (state.payer < 200) throw Error('insufficient_funds');
      state.payer -= 200;
      state.merchant += 200;
      state.operationCount++;
      state.status = 'paid';
      return 'ok';
    }),
    cancel: (actor = 'merchant') => serialize(() => {
      if (actor !== 'merchant') throw Error('unauthorized');
      if (state.status === 'paid') throw Error('already_paid');
      if (state.status === 'pending') state.status = 'cancelled';
      return state.status;
    })
  };
}

test('pago primero impide cancelar despues', async () => {
  const m = setup();
  const [pay, cancel] = await Promise.allSettled([m.pay(), m.cancel()]);
  assert.equal(pay.value, 'ok');
  assert.match(cancel.reason.message, /already_paid/);
  assert.deepEqual(m.state, { payer: 800, merchant: 200, status: 'paid', operationCount: 1 });
});

test('cancelacion primero impide pago posterior', async () => {
  const m = setup();
  const [cancel, pay] = await Promise.allSettled([m.cancel(), m.pay()]);
  assert.equal(cancel.value, 'cancelled');
  assert.match(pay.reason.message, /unavailable/);
  assert.deepEqual(m.state, { payer: 1000, merchant: 0, status: 'cancelled', operationCount: 0 });
});

test('dos pagos simultaneos producen una sola operacion', async () => {
  const m = setup();
  const values = await Promise.all([m.pay(), m.pay()]);
  assert.deepEqual(values, ['ok', 'already_processed']);
  assert.equal(m.state.operationCount, 1);
  assert.equal(m.state.payer + m.state.merchant, 1000);
});

test('dos cancelaciones mantienen estado cancelado sin movimientos', async () => {
  const m = setup();
  assert.deepEqual(await Promise.all([m.cancel(), m.cancel()]), ['cancelled', 'cancelled']);
  assert.equal(m.state.operationCount, 0);
  assert.equal(m.state.payer + m.state.merchant, 1000);
});

test('tercero no puede cancelar solicitud del comercio', async () => {
  const m = setup();
  await assert.rejects(m.cancel('outsider'), /unauthorized/);
  assert.deepEqual(m.state, { payer: 1000, merchant: 0, status: 'pending', operationCount: 0 });
});
