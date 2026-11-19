// Pruebas de comportamiento de envío real del cliente, con dependencias simuladas.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const start = source.indexOf('async function executeOperation(');
const end = source.indexOf('function prepareOperation(', start);
assert.ok(start >= 0 && end > start);
const implementation = source.slice(start, end);

function harness({ setError = null, removeError = null, rpcError = null, status = 'ok', onSet = null } = {}) {
  const calls = { writes: [], deletes: [], rpc: [], messages: [], pending: [], refresh: 0 };
  const context = {
    userId: 'A', pendingLoading: false, pendingStorageError: false,
    recoveringRef: { current: false }, busyRef: { current: false },
    pendingRef: { current: null }, pendingOperation: null,
    activeUserRef: { current: 'A' },
    uniqueRequestId: () => '00000000-0000-4000-8000-000000000001',
    AsyncStorage: {
      setItem: async (key, value) => { calls.writes.push({ key, value }); if (onSet) onSet(context); if (setError) throw setError; },
      removeItem: async key => { calls.deletes.push(key); if (removeError) throw removeError; },
    },
    supabase: { rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: { status }, error: rpcError }; } },
    setBusy: () => {}, setPendingOperation: value => calls.pending.push(value),
    setAmount: () => {}, setRecipientCode: () => {}, setScreen: () => {},
    refreshAccount: async () => { calls.refresh++; return true; },
    message: (...args) => calls.messages.push(args),
  };
  vm.createContext(context);
  vm.runInContext(implementation + '\nthis.executeOperation = executeOperation;', context, { timeout: 1000 });
  return { context, calls };
}

test('guarda solicitud antes de llamar a RPC y la elimina tras confirmación', async () => {
  const { context, calls } = harness();
  await context.executeOperation('transfer', 150, 'MWD-0123456789ABCDEF');
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.deletes.length, 1);
  assert.equal(calls.refresh, 1);
  assert.equal(calls.rpc[0].args.p_request_id, JSON.parse(calls.writes[0].value).id);
  assert.equal(context.pendingRef.current, null);
});
test('si falla almacenamiento antes del envío no llama a RPC', async () => {
  const { context, calls } = harness({ setError: new Error('disco lleno') });
  await context.executeOperation('transfer', 150, 'MWD-0123456789ABCDEF');
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.deletes.length, 0);
  assert.equal(context.busyRef.current, false);
});
test('si falla red después del envío conserva referencia para recuperación', async () => {
  const { context, calls } = harness({ rpcError: new Error('sin conexión') });
  await context.executeOperation('transfer', 150, 'MWD-0123456789ABCDEF');
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.deletes.length, 0);
  assert.equal(context.pendingRef.current.id, calls.rpc[0].args.p_request_id);
});
test('si falla borrar referencia tras éxito conserva solicitud pendiente', async () => {
  const { context, calls } = harness({ removeError: new Error('sin acceso') });
  await context.executeOperation('contribution', 100);
  assert.equal(calls.rpc.length, 1);
  assert.equal(context.pendingRef.current.id, calls.rpc[0].args.p_request_id);
  assert.equal(calls.refresh, 0);
});
test('cambio de sesión durante escritura evita RPC de la cuenta anterior', async () => {
  const { context, calls } = harness({ onSet: ctx => { ctx.activeUserRef.current = 'B'; } });
  await context.executeOperation('transfer', 100, 'MWD-0123456789ABCDEF');
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.rpc.length, 0);
});
test('respuesta RPC inesperada conserva la solicitud pendiente', async () => {
  const { context, calls } = harness({ status: 'unknown' });
  await context.executeOperation('contribution', 100);
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.deletes.length, 0);
  assert.ok(context.pendingRef.current);
});
