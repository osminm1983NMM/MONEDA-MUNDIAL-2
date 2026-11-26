const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const app = fs.readFileSync(require.resolve('../App.js'), 'utf8');
function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return app.slice(from, to);
}

function device(rpc, storage = new Map()) {
  const notices = [];
  const ctx = vm.createContext({
    notices, userId: 'A', isCurrentUser: id => id === ctx.userId,
    supabase: { rpc }, message: (title, detail) => notices.push([title, detail]),
    AsyncStorage: {
      getItem: async key => storage.get(key), setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    },
    swapQuoteRef: { current: { quoteId: 'quote-A' } }, swapBusyTokenRef: { current: null },
    swapBusy: false, pickupBusyRef: { current: false }, pickupPendingRef: { current: null },
    pendingPickup: null, pickupPendingError: '', pickupAmount: '10.00',
    uniqueRequestId: () => '469bea32-c0b9-43bd-b2e4-cadcaf0a3883',
  });
  for (const key of ['SwapBusy','SwapAmount','SwapWallet','SwapQuote','PickupBusy','PendingPickup',
    'PickupPendingError','PickupAmount','PickupResult']) {
    ctx['set' + key] = value => { ctx[key[0].toLowerCase() + key.slice(1)] = value; };
  }
  vm.runInContext([
    section('const LIMIT_CENTS', 'function uniqueRequestId'),
    section('function beginSwapBusy', 'useEffect(() =>'),
    section('async function confirmSwap', 'async function loadPickupOrders'),
  ].join('\n'), ctx);
  return ctx;
}

test('el doble toque confirma una sola cotización y el fallo de lectura posterior queda separado', async () => {
  let finish;
  const calls = [];
  const ctx = device(async (name, args) => {
    calls.push(name);
    if (name === 'mwd_conversion_wallet_demo') throw Error('offline');
    assert.equal(args.p_quote_id, 'quote-A');
    await new Promise(resolve => { finish = resolve; });
    return { data: {status:'ok'} };
  });
  const first = ctx.confirmSwap('quote-A');
  await ctx.confirmSwap('quote-A');
  finish();
  await first;
  assert.deepEqual(calls, ['mwd_conversion_confirm_demo','mwd_conversion_wallet_demo']);
  assert.equal(ctx.swapQuoteRef.current, null);
  assert.equal(ctx.notices.at(-1)[0], 'Saldo pendiente de actualizar');
});

for (const [status, reason, keep] of [
  [400, 'Cotización vencida', false], [400, 'Reconciliación pendiente', true], [0,'Sin conexión',true],
]) {
  test('conversión ante ' + reason, async () => {
    const ctx = device(async () => ({status, error:{code:'P0001',message:reason}}));
    await ctx.confirmSwap('quote-A');
    assert.equal(ctx.swapQuoteRef.current?.quoteId, keep ? 'quote-A' : undefined);
    assert.equal(ctx.swapBusy, false);
    assert.equal(ctx.notices[0][0], keep ? 'Conversión no confirmada' : 'Cotización rechazada');
  });
}

test('retiro a Honduras conserva la referencia al reiniciar y resiste dos toques', async () => {
  const storage = new Map();
  const attempts = [];
  let finish;
  const ctx = device(async (name,args) => {
    assert.equal(name,'mwd_pickup_create_demo');
    assert.equal(args.p_destination_country,'HN');
    assert.equal(args.p_amount_cents,1000);
    attempts.push(args.p_request_id);
    await new Promise(resolve => { finish = resolve; });
    throw Error('Respuesta perdida');
  }, storage);
  const first = ctx.createDemoPickup();
  await new Promise(resolve => setImmediate(resolve));
  await ctx.createDemoPickup();
  finish();
  await first;
  assert.equal(storage.size,1);
  const restarted = device(async (name,args) => {
    attempts.push(args.p_request_id);
    return {data:{status:'already_created',orderId:'469bea32-c0b9-43bd-b2e4-cadcaf0a3883',realPaymentsEnabled:false,pickupCode:null}};
  }, storage);
  restarted.uniqueRequestId = () => assert.fail('El reintento debe usar el identificador guardado');
  await restarted.recoverPendingPickup();
  assert.equal(restarted.pickupAmount,'10.00');
  await restarted.createDemoPickup();
  assert.deepEqual(attempts,[attempts[0],attempts[0]]);
  assert.equal(restarted.pickupResult.pickupCode,null);
  assert.equal(restarted.notices.at(-1)[0],'Orden ficticia recuperada');
  assert.equal(storage.size,0);
});

test('la confirmación de A que llega tras cambiar a B no modifica la pantalla de B', async () => {
  let finish;
  const ctx = device(() => new Promise(resolve => { finish = resolve; }));
  const pending = ctx.confirmSwap('quote-A');
  await new Promise(resolve => setImmediate(resolve));
  ctx.userId = 'B';
  finish({data:{status:'ok'}});
  await pending;
  assert.deepEqual(ctx.notices,[]);
  assert.equal(ctx.swapWallet,undefined);
});


test('retiro con respuesta incompleta conserva la referencia', async () => {
  const storage = new Map();
  const ctx = device(async () => ({data:{status:'created'}}), storage);
  await ctx.createDemoPickup();
  assert.equal(storage.size,1);
  assert.equal(ctx.pickupResult,null);
  assert.equal(ctx.notices.at(-1)[0],'Retiro pendiente de confirmar');
});
