const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const app = fs.readFileSync(require.resolve('../App.js'), 'utf8');
function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from);
  return app.slice(from, to);
}
const handlers = [
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
      return { data: { status: 'ok' } };
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
