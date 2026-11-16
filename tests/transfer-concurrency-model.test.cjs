// Modelo local de concurrencia DEMO, sin conexión a Supabase.
// Simula la serialización de operaciones sobre las mismas billeteras.
// NO demuestra el comportamiento real de bloqueos PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');

function createLedger() {
  const balances = new Map([['A', 10000], ['B', 2500], ['C', 0]]);
  const requests = new Map();
  let tail = Promise.resolve();
  const submit = request => {
    const operation = tail.then(async () => {
      const { id, from, to, amount } = request;
      if (typeof id !== 'string' || !id || from === to ||
          !Number.isSafeInteger(amount) || amount <= 0) throw Error('invalid');
      if (!balances.has(from) || !balances.has(to)) throw Error('unknown');
      if (requests.has(id)) {
        const prior = requests.get(id);
        if (prior.from !== from || prior.to !== to || prior.amount !== amount) throw Error('conflict');
        return { status: 'already_processed' };
      }
      if (balances.get(from) < amount) throw Error('insufficient');
      balances.set(from, balances.get(from) - amount);
      balances.set(to, balances.get(to) + amount);
      requests.set(id, { from, to, amount });
      return { status: 'ok' };
    });
    tail = operation.catch(() => {});
    return operation;
  };
  return { balances, requests, submit };
}

test('20 reintentos concurrentes solo descuentan una vez', async () => {
  const ledger = createLedger();
  const req = { id: 'same', from: 'A', to: 'B', amount: 3000 };
  const results = await Promise.all(Array.from({ length: 20 }, () => ledger.submit(req)));
  assert.equal(results.filter(r => r.status === 'ok').length, 1);
  assert.equal(results.filter(r => r.status === 'already_processed').length, 19);
  assert.equal(ledger.balances.get('A'), 7000);
  assert.equal(ledger.balances.get('B'), 5500);
  assert.equal(ledger.requests.size, 1);
});

test('dos transferencias simultaneas no sobregiran una cuenta', async () => {
  const ledger = createLedger();
  const results = await Promise.allSettled([
    ledger.submit({ id: 'x', from: 'A', to: 'B', amount: 8000 }),
    ledger.submit({ id: 'y', from: 'A', to: 'C', amount: 8000 })
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(ledger.balances.get('A'), 2000);
  assert.equal([...ledger.balances.values()].reduce((a,b) => a+b,0), 12500);
});

test('solicitudes concurrentes con misma clave y datos distintos producen conflicto', async () => {
  const ledger = createLedger();
  const results = await Promise.allSettled([
    ledger.submit({ id: 'same', from: 'A', to: 'B', amount: 100 }),
    ledger.submit({ id: 'same', from: 'A', to: 'B', amount: 200 })
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.match(results[1].reason.message, /conflict/);
  assert.equal(ledger.balances.get('A'), 9900);
});
