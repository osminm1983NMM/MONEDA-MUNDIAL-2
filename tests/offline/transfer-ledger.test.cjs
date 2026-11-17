// Simulador local de invariantes para Moneda Mundial DEMO.
// NO conecta a Supabase; NO sustituye pruebas reales de concurrencia.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');

function createLedger(initialBalances) {
  const balances = new Map(Object.entries(initialBalances));
  const requests = new Map();
  const operations = [];
  function transfer({ actor, to, cents, requestId }) {
    if (!Number.isSafeInteger(cents) || cents <= 0) throw Error('invalid_amount');
    if (actor === to || !balances.has(actor) || !balances.has(to)) throw Error('invalid_recipient');
    const key = actor + ':' + requestId;
    if (requests.has(key)) {
      const previous = requests.get(key);
      if (previous.to !== to || previous.cents !== cents) throw Error('request_conflict');
      return { status: 'already_processed' };
    }
    if (balances.get(actor) < cents) throw Error('insufficient_funds');
    if (!Number.isSafeInteger(balances.get(to) + cents)) throw Error('overflow');
    balances.set(actor, balances.get(actor) - cents);
    balances.set(to, balances.get(to) + cents);
    requests.set(key, { to, cents });
    operations.push({ actor, to, cents, requestId });
    return { status: 'transferred' };
  }
  return { balances, operations, transfer };
}
const total = ledger => [...ledger.balances.values()].reduce((a, b) => a + b, 0);

test('repetir requestId con mismos datos no debita dos veces', () => {
  const l = createLedger({ A: 1000, B: 0 });
  assert.equal(l.transfer({ actor: 'A', to: 'B', cents: 400, requestId: 'r1' }).status, 'transferred');
  assert.equal(l.transfer({ actor: 'A', to: 'B', cents: 400, requestId: 'r1' }).status, 'already_processed');
  assert.equal(l.operations.length, 1);
  assert.equal(l.balances.get('A'), 600);
  assert.equal(l.balances.get('B'), 400);
});

test('reutilizar requestId con distinto monto falla', () => {
  const l = createLedger({ A: 1000, B: 0 });
  l.transfer({ actor: 'A', to: 'B', cents: 200, requestId: 'r1' });
  assert.throws(() => l.transfer({ actor: 'A', to: 'B', cents: 300, requestId: 'r1' }), /request_conflict/);
  assert.equal(l.operations.length, 1);
});

test('fondos insuficientes no producen saldos negativos', () => {
  const l = createLedger({ A: 1000, B: 0, C: 0 });
  l.transfer({ actor: 'A', to: 'B', cents: 700, requestId: 'r1' });
  assert.throws(() => l.transfer({ actor: 'A', to: 'C', cents: 700, requestId: 'r2' }), /insufficient_funds/);
  assert.equal(l.balances.get('A'), 300);
  assert.equal(total(l), 1000);
});

test('transferencias cruzadas conservan el total', () => {
  const l = createLedger({ A: 1000, B: 1000 });
  l.transfer({ actor: 'A', to: 'B', cents: 250, requestId: 'r1' });
  l.transfer({ actor: 'B', to: 'A', cents: 450, requestId: 'r2' });
  assert.equal(total(l), 2000);
  assert.equal(l.balances.get('A'), 1200);
  assert.equal(l.balances.get('B'), 800);
});

test('rechaza autoenvíos y montos inválidos', () => {
  const l = createLedger({ A: 1000, B: 0 });
  assert.throws(() => l.transfer({ actor: 'A', to: 'A', cents: 100, requestId: 'r1' }), /invalid_recipient/);
  assert.throws(() => l.transfer({ actor: 'A', to: 'B', cents: 0, requestId: 'r2' }), /invalid_amount/);
  assert.equal(l.operations.length, 0);
});
