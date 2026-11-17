'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function paymentModel(initialPayer = 1000, initialMerchant = 0) {
  const wallets = { payer: initialPayer, merchant: initialMerchant };
  const payments = new Map();
  let queue = Promise.resolve();
  const create = (id, amount) => payments.set(id, { amount, status: 'pending', payer: null });
  const pay = (id, actor = 'payer') => {
    const task = queue.then(() => {
      const p = payments.get(id);
      if (!p) throw Error('not_found');
      if (actor === 'merchant') throw Error('self_payment');
      if (p.status === 'paid') {
        if (p.payer === actor) return 'already_processed';
        throw Error('already_paid');
      }
      if (p.status !== 'pending') throw Error('unavailable');
      if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw Error('invalid_amount');
      if (wallets[actor] < p.amount) throw Error('insufficient_funds');
      wallets[actor] -= p.amount;
      wallets.merchant += p.amount;
      p.status = 'paid';
      p.payer = actor;
      return 'ok';
    });
    queue = task.catch(() => {});
    return task;
  };
  return { wallets, payments, create, pay };
}

test('20 pagos simultaneos de una misma solicitud generan un solo cargo', async () => {
  const m = paymentModel(); m.create('payment-1', 125);
  const results = await Promise.all(Array.from({ length: 20 }, () => m.pay('payment-1')));
  assert.equal(results.filter(x => x === 'ok').length, 1);
  assert.equal(results.filter(x => x === 'already_processed').length, 19);
  assert.deepEqual(m.wallets, { payer: 875, merchant: 125 });
});

test('saldo insuficiente deja solicitud pendiente y no mueve dinero', async () => {
  const m = paymentModel(10); m.create('payment-2', 20);
  await assert.rejects(m.pay('payment-2'), /insufficient_funds/);
  assert.equal(m.payments.get('payment-2').status, 'pending');
  assert.deepEqual(m.wallets, { payer: 10, merchant: 0 });
});

test('comercio no puede pagar su propia solicitud', async () => {
  const m = paymentModel(); m.create('payment-3', 20);
  await assert.rejects(m.pay('payment-3', 'merchant'), /self_payment/);
  assert.deepEqual(m.wallets, { payer: 1000, merchant: 0 });
});

test('reintento de pago ya procesado no duplica saldo', async () => {
  const m = paymentModel(); m.create('payment-4', 400);
  assert.equal(await m.pay('payment-4'), 'ok');
  assert.equal(await m.pay('payment-4'), 'already_processed');
  assert.deepEqual(m.wallets, { payer: 600, merchant: 400 });
});
