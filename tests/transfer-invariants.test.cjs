// Pruebas aisladas del contrato contable DEMO. No conecta con Supabase ni altera saldos reales.
// Ejecutar: node --test tests/transfer-invariants.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');

function transfer(state, { id, from, to, amount }) {
  if (!id || !from || !to || from === to || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('invalid transfer');
  }
  if (state.processed.has(id)) return state;
  if (!(from in state.balances) || !(to in state.balances)) throw new Error('unknown account');
  if (state.balances[from] < amount) throw new Error('insufficient funds');
  const balances = { ...state.balances, [from]: state.balances[from] - amount, [to]: state.balances[to] + amount };
  if (!Number.isSafeInteger(balances[to])) throw new Error('overflow');
  return { balances, processed: new Set([...state.processed, id]), journal: [...state.journal, { id, from, to, amount }] };
}
const initial = () => ({ balances: { A: 10000, B: 2500 }, processed: new Set(), journal: [] });
const total = s => Object.values(s.balances).reduce((a, b) => a + b, 0);

test('transferencia conserva el total y registra un movimiento', () => {
  const before = initial();
  const after = transfer(before, { id: 't1', from: 'A', to: 'B', amount: 3000 });
  assert.deepEqual(after.balances, { A: 7000, B: 5500 });
  assert.equal(total(after), total(before));
  assert.equal(after.journal.length, 1);
  assert.deepEqual(before.balances, { A: 10000, B: 2500 });
});
test('reintento con mismo ID no duplica movimiento', () => {
  const request = { id: 't1', from: 'A', to: 'B', amount: 3000 };
  const once = transfer(initial(), request);
  const twice = transfer(once, request);
  assert.strictEqual(twice, once);
  assert.equal(twice.journal.length, 1);
});
test('fondos insuficientes no cambian estado', () => {
  const before = initial();
  assert.throws(() => transfer(before, { id: 't2', from: 'A', to: 'B', amount: 10001 }), /insufficient/);
  assert.equal(before.journal.length, 0);
  assert.equal(total(before), 12500);
});
test('rechaza importes invalidos y auto-transferencias', () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => transfer(initial(), { id: 'bad', from: 'A', to: 'B', amount }));
  }
  assert.throws(() => transfer(initial(), { id: 'bad', from: 'A', to: 'A', amount: 1 }));
});
test('IDs diferentes se procesan por separado', () => {
  const one = transfer(initial(), { id: 'a', from: 'A', to: 'B', amount: 100 });
  const two = transfer(one, { id: 'b', from: 'B', to: 'A', amount: 50 });
  assert.equal(two.journal.length, 2);
  assert.equal(total(two), 12500);
});
