// Pruebas de comportamiento de la función real de recuperación, sin conexión ni transferencias.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const start = source.indexOf('async function recoverPending()');
const end = source.indexOf('async function retryPending()', start);
assert.ok(start >= 0 && end > start);
const implementation = source.slice(start, end);

function harness({ status = 'unconfirmed', rpcError = null, storageError = null, rpcOverride = null } = {}) {
  const item = { id: 'a', userId: 'A', type: 'transfer', cents: 100, code: 'MWD-0123456789ABCDEF' };
  const calls = { rpc: 0, remove: 0, refresh: 0, messages: [], unconfirmed: [], pending: [], recovering: [] };
  const context = {
    pendingRef: { current: item }, pendingOperation: item, userId: 'A',
    activeUserRef: { current: 'A' }, recoveringRef: { current: false },
    busyRef: { current: false }, pendingLoading: false, pendingStorageError: false,
    supabase: { rpc: async (...args) => { calls.rpc++; return rpcOverride ? rpcOverride(...args) : { data: { status }, error: rpcError }; } },
    AsyncStorage: { removeItem: async () => { calls.remove++; if (storageError) throw storageError; } },
    setPendingUnconfirmed: v => calls.unconfirmed.push(v),
    setRecovering: v => calls.recovering.push(v),
    setPendingOperation: v => calls.pending.push(v),
    refreshAccount: async () => { calls.refresh++; return true; },
    message: (...args) => calls.messages.push(args),
  };
  vm.createContext(context);
  vm.runInContext(implementation + '\nthis.recoverPending = recoverPending;', context, { timeout: 1000 });
  return { context, calls, item };
}

test('estado no confirmado conserva referencia y habilita reintento protegido', async () => {
  const { context, calls, item } = harness();
  await context.recoverPending();
  assert.equal(calls.rpc, 1);
  assert.equal(calls.remove, 0);
  assert.equal(context.pendingRef.current, item);
  assert.equal(calls.unconfirmed.at(-1), true);
  assert.equal(context.recoveringRef.current, false);
});
test('operación confirmada elimina referencia solo después de verificar estado', async () => {
  const { context, calls } = harness({ status: 'processed' });
  await context.recoverPending();
  assert.equal(calls.rpc, 1);
  assert.equal(calls.remove, 1);
  assert.equal(calls.refresh, 1);
  assert.equal(context.pendingRef.current, null);
  assert.equal(calls.pending.at(-1), null);
});
test('error de conexión conserva la referencia pendiente', async () => {
  const { context, calls, item } = harness({ rpcError: new Error('sin conexión') });
  await context.recoverPending();
  assert.equal(calls.remove, 0);
  assert.equal(context.pendingRef.current, item);
  assert.equal(context.recoveringRef.current, false);
  assert.match(calls.messages.at(-1)[1], /sin conexión/);
});
test('fallo al eliminar almacenamiento conserva la referencia', async () => {
  const { context, calls, item } = harness({ status: 'processed', storageError: new Error('almacenamiento') });
  await context.recoverPending();
  assert.equal(calls.remove, 1);
  assert.equal(context.pendingRef.current, item);
  assert.equal(calls.refresh, 0);
});
test('dos pulsaciones simultáneas solo lanzan una consulta RPC', async () => {
  let resolveRpc;
  const wait = new Promise(resolve => { resolveRpc = resolve; });
  const { context, calls } = harness({ rpcOverride: () => wait });
  const first = context.recoverPending();
  const second = context.recoverPending();
  assert.equal(calls.rpc, 1);
  resolveRpc({ data: { status: 'unconfirmed' }, error: null });
  await Promise.all([first, second]);
  assert.equal(calls.rpc, 1);
  assert.equal(context.recoveringRef.current, false);
});
test('cambio de cuenta durante la consulta no borra referencia de A', async () => {
  let resolveRpc;
  const wait = new Promise(resolve => { resolveRpc = resolve; });
  const { context, calls, item } = harness({ rpcOverride: () => wait });
  const task = context.recoverPending();
  context.activeUserRef.current = 'B';
  resolveRpc({ data: { status: 'processed' }, error: null });
  await task;
  assert.equal(calls.remove, 0);
  assert.equal(context.pendingRef.current, item);
});
