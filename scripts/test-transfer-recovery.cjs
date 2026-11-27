const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { createQuoteReader } = require('../remittance-quote');

const app = fs.readFileSync(require.resolve('../App.js'), 'utf8');
function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from);
  return app.slice(from, to);
}
const handlers = [
  section('function syncErrorMessage', 'function pendingOperationStorageKey'),
  section('function parsePendingOperation', 'function parsePendingPickup'),
  section('function pendingOperationStorageKey', 'function pendingPickupStorageKey'),
  section('function isDefinitiveRpcRejection', 'function amountToCents'),
  section('async function recoverPendingOperation', 'function changeAmount'),
  section('async function executeOperation', 'function prepareOperation'),
].join('\n');
const recipient = 'MWD-0123456789ABCDEF';
const requestId = '469bea32-c0b9-43bd-b2e4-cadcaf0a3883';

function device(storage, rpc) {
  const noop = () => {};
  const ctx = vm.createContext({
    LIMIT_CENTS: 100000000, AbortController, setTimeout, clearTimeout,
    userId: 'sender', currentUserRef: { current: 'sender' }, busyRef: { current: false },
    pendingRef: { current: null }, isCurrentUser: id => id === 'sender',
    AsyncStorage: {
      getItem: async key => storage.get(key),
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    },
    supabase: { rpc }, uniqueRequestId: () => requestId, refreshAccount: noop,
    setBusy: noop, setPendingOperation: noop, setPendingOperationRecoveryError: noop,
    setSyncNotice: noop, setAmount: noop, setRecipientCode: noop, setScreen: noop, message: noop,
  });
  vm.runInContext(handlers, ctx);
  return ctx;
}

for (const committed of [true, false]) {
  test('restart after connection loss, server committed = ' + committed, async () => {
    const storage = new Map();
    const attempts = [];
    const first = device(storage, async (name, args) => {
      attempts.push([name, args.p_request_id]);
      throw new Error('Connection lost');
    });
    await first.executeOperation('transfer', 100, recipient);
    assert.equal(JSON.parse(storage.get('mwd_pending_operation:sender')).id, requestId);

    let statusQueries = 0;
    let resumeLookup;
    const gate = new Promise(resolve => { resumeLookup = resolve; });
    const restarted = device(storage, async (name, args) => {
      if (name === 'mwd_operation_status_demo') {
        statusQueries++;
        if (statusQueries === 1) await gate;
        return { data: committed
          ? { status: 'processed', kind: 'transfer', amountCents: 100, recipientCode: recipient }
          : { status: 'unconfirmed' } };
      }
      attempts.push([name, args.p_request_id]);
      return { data: { status: 'ok', operation_id: requestId } };
    });
    restarted.uniqueRequestId = () => assert.fail('A retry must reuse the stored reference');
    const recovery = restarted.recoverPendingOperation();
    await new Promise(resolve => setImmediate(resolve));
    await restarted.executeOperation('transfer', 100, recipient);
    assert.equal(statusQueries, 1);
    assert.equal(attempts.length, 1);
    resumeLookup();
    await recovery;
    if (!committed) await restarted.executeOperation('transfer', 100, recipient);
    assert.equal(attempts.length, committed ? 1 : 2);
    for (const attempt of attempts) assert.deepEqual(attempt, ['mwd_transfer_demo', requestId]);
    assert.equal(storage.size, 0);
    assert.equal(restarted.busyRef.current, false);
  });
}

function storedTransfer() {
  return new Map([['mwd_pending_operation:sender', JSON.stringify({
    userId: 'sender', id: requestId, type: 'transfer', code: recipient, cents: 100,
  })]]);
}

test('continued outage on restart retains the reference through repeated retries', async () => {
  const storage = storedTransfer();
  const calls = [];
  const app = device(storage, async (name, args) => {
    calls.push([name, args.p_request_id]);
    return { error: { message: 'Network request failed' } };
  });
  await app.recoverPendingOperation();
  for (let i = 0; i < 2; i++) await app.executeOperation('transfer', 100, recipient);
  assert.deepEqual(calls, Array(3).fill(['mwd_operation_status_demo', requestId]));
  assert.equal(storage.get('mwd_pending_operation:sender'), storedTransfer().get('mwd_pending_operation:sender'));
  assert.equal(app.pendingRef.current.id, requestId);
  assert.equal(app.busyRef.current, false);
});

test('confirmed transfer followed by a failed refresh stays confirmed with balance pending', async () => {
  const storage = storedTransfer();
  const appContext = device(storage, async (name) => {
    assert.equal(name, 'mwd_operation_status_demo');
    return { data: { status: 'processed', kind: 'transfer', recipientCode: recipient, amountCents: 100 } };
  });
  let notice;
  let reads = 0;
  const failedRead = Promise.resolve({ error: { message: 'Disconnected' } });
  const table = {
    select() { return this; }, eq() { return this; }, or() { return this; }, order() { return this; },
    abortSignal() { return this; }, single() { return failedRead; }, maybeSingle() { return failedRead; },
    limit() { return this; }, then(resolve) { return failedRead.then(resolve); },
  };
  appContext.supabase.from = () => { reads++; return table; };
  appContext.setSyncNotice = value => { notice = value; };
  appContext.setSyncing = () => {};
  appContext.refreshAccountVersionRef = { current: 0 };
  appContext.readAccountWithDeadline = createQuoteReader(2);
  vm.runInContext(section('async function refreshAccount', 'async function authenticate'), appContext);
  await appContext.recoverPendingOperation();
  assert.equal(reads, 3, 'The actual account read must run');
  assert.equal(notice, 'Operación confirmada. Saldo e historial pendientes de actualizar.');
  assert.equal(storage.size, 0);
  assert.equal(appContext.pendingRef.current, null);
});

for (const [status, code, reason, keepReference] of [
  [400, 'P0001', 'Saldo insuficiente', false],
  [400, 'P0001', 'Identificador reutilizado', true],
  [503, 'P0001', 'Servicio temporalmente no disponible', true],
  [0, '', 'Network request failed', true],
]) {
  test('transferencia ante ' + reason, async () => {
    const storage = new Map();
    const app = device(storage, async () => ({ status, error: { code, message: reason } }));
    const notices = [];
    app.message = title => notices.push(title);
    await app.executeOperation('transfer', 100, recipient);
    assert.equal(storage.has('mwd_pending_operation:sender'), keepReference);
    assert.deepEqual(notices, [keepReference ? 'Operación no confirmada' : 'Operación rechazada']);
    assert.equal(app.busyRef.current, false);
  });
}

test('una consulta sin respuesta libera el botón y permite actualizar la cuenta siguiente', async () => {
  let syncing;
  let wallet;
  let hanging = true;
  const signals = [];
  const query = {
    select() { return this; }, eq() { return this; }, or() { return this; },
    order() { return this; }, limit() { return this; }, single() { return this; },
    maybeSingle() { return this; },
    abortSignal(signal) { signals.push(signal); this.signal = signal; return this; },
    then(resolve) {
      if (hanging) this.signal.addEventListener('abort', () => resolve({ error: Error('Abort') }));
      else resolve({ data: { user_id: 'B' } });
    },
  };
  const noop = () => {};
  const ctx = vm.createContext({
    AbortController, currentUserRef: { current: 'A' }, refreshAccountVersionRef: { current: 0 },
    isCurrentUser: id => id === ctx.currentUserRef.current,
    setSyncing: value => { syncing = value; }, setWallet: value => { wallet = value; },
    setSyncNotice: noop, setOperations: noop, setAdminRole: noop, message: noop,
    readAccountWithDeadline: (() => { const read = createQuoteReader(2); return fn => read(fn, 50); })(),
    supabase: { from: () => Object.create(query) },
  });
  vm.runInContext(section('function syncErrorMessage', 'function pendingOperationStorageKey') + '\n' + section('async function refreshAccount', 'async function authenticate'), ctx);
  const first = ctx.refreshAccount('A');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(syncing, true);
  assert.equal(await first, false);
  assert.equal(syncing, false);
  assert.equal(signals.length, 3);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(wallet, undefined);
  hanging = false;
  ctx.currentUserRef.current = 'B';
  assert.equal(await ctx.refreshAccount('B'), true);
  assert.equal(wallet.user_id, 'B');
  assert.equal(syncing, false);
});

for (const failure of ['getItem','setItem']) {
  test('transferencia: fallo local '+failure+' impide enviar y exige revisión', async () => {
    const storage = new Map(); let calls=0; let recoveryError; const notices=[];
    const ctx=device(storage,async()=>{calls++;throw Error('RPC no esperada');});
    ctx.AsyncStorage[failure]=async()=>{throw Error('Almacenamiento no disponible');};
    ctx.setPendingOperationRecoveryError=value=>{recoveryError=value;};
    ctx.message=title=>notices.push(title);
    await ctx.executeOperation('transfer',100,recipient);
    assert.equal(calls,0); assert.match(recoveryError,/referencia local/);
    assert.deepEqual(notices,['Referencia no verificada']); assert.equal(ctx.busyRef.current,false);
  });
}
