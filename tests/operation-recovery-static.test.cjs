// Static safety gates for the Android demo. Run: node tests/operation-recovery-static.test.cjs
// These checks inspect source structure; they do NOT simulate Android, network failures,
// database transactions or guarantee idempotency on their own.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
const operationStart = app.indexOf('async function executeOperation(');
const operationEnd = app.indexOf('function prepareOperation(', operationStart);
assert.ok(operationStart >= 0 && operationEnd > operationStart, 'operation flow exists');
const operation = app.slice(operationStart, operationEnd);
const index = (needle) => {
  const i = operation.indexOf(needle);
  assert.ok(i >= 0, 'missing safety condition: ' + needle);
  return i;
};
const save = index('await AsyncStorage.setItem(storageKey, JSON.stringify(pendingRef.current))');
const request = index("const response = type === 'transfer'");
assert.ok(save < request, 'request ID must be persisted before sending RPC');
assert.ok(index("if (pending) {") < request, 'retry must inspect pending operation');
assert.ok(index("mwd_operation_status_demo") < request, 'check status before retry');
assert.ok(index("check.data.kind !== type || check.data.amountCents !== cents") < request,
  'match the original operation before treating it as confirmed');
assert.ok(index("if (check.data?.status !== 'unconfirmed')") < request,
  'unknown statuses must block sending');
assert.ok(index("pending.type !== type || pending.cents !== cents || pending.code !== code") < request,
  'changed operation details must not reuse a pending ID');
assert.ok(app.includes("pendingRecoveryErrorRef.current = true"),
  'storage restoration failure must be tracked');
assert.ok(app.includes("if (pendingRecoveryErrorRef.current)"),
  'storage restoration failure must block sending');
assert.ok(app.includes("if (!pending && cents > wallet.balance_cents)"),
  'balance check must not block retry after an uncertain debit');
assert.ok(app.includes("const key = 'mwd_demo_operation_pending_' + userId"),
  'pending storage must be scoped to the signed-in user');
assert.ok(operation.includes('refreshAccount().catch(() => {})'),
  'UI refresh errors must not turn a confirmed RPC into an unconfirmed operation');
assert.ok(app.includes("test(p.id)") && app.includes("test(candidate.id)"),
  'both recovery paths must validate the persisted UUID');
assert.ok(app.includes(String.raw`/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/`),
  'conversion amount regex must match digits and decimal points');
assert.ok(app.includes("test(previous.id)"), 'pickup recovery must validate persisted request ID');
const swapStart = app.indexOf('async function confirmSwap()');
const pickupStart = app.indexOf('async function createDemoPickup()', swapStart);
assert.ok(swapStart >= 0 && pickupStart > swapStart, 'swap confirmation flow exists');
const swap = app.slice(swapStart, pickupStart);
assert.ok(swap.indexOf("message('Conversión ficticia'") <
  swap.indexOf("const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo')"),
  'swap success must be shown before optional balance refresh');
const navStart = app.indexOf('function navigate(to)');
const navEnd = app.indexOf('\n  return (', navStart);
assert.ok(navStart >= 0 && navEnd > navStart, 'navigation flow exists');
const nav = app.slice(navStart, navEnd);
assert.ok(!nav.includes('pendingRef.current = null'),
  'navigation must not discard unresolved idempotency key');
assert.ok(nav.includes('if (!pendingRef.current)'),
  'navigation must retain original amount and destination when a request is pending');
assert.ok(app.includes("pickupPendingRef.current = null;\n    setPickupAmount('');\n    setPickupResult(null);\n    setPickupOrders([]);\n  }, [userId]);"),
  'pickup request memory must be cleared on account switch');
assert.ok(app.includes(String.raw`'\nConsulta los saldos antes de intentar otra conversión.'`),
  'conversion recovery message must use a real newline escape');
const pickup = app.slice(pickupStart, app.indexOf('async function loadPickupOrders()', pickupStart));
assert.ok(pickup.includes('try {\n        await AsyncStorage.removeItem(storageKey);\n      } catch (_cleanupError)'),
  'pickup success must tolerate failure to clear saved request ID');
assert.ok(operation.includes('pendingRecoveryErrorRef.current = true;'),
  'confirmed transfer with failed cleanup must block new requests until recovery');
assert.ok(operation.includes('if (check.data?.status === \'processed\')') &&
  operation.includes('try {\n            await AsyncStorage.removeItem(storageKey);'),
  'already-processed recovery must not fail when local cleanup fails');
assert.ok(operation.includes('verified = true;\n            try {') &&
  operation.includes("await AsyncStorage.removeItem('mwd_demo_operation_pending_' + userId)"),
  'timeout recovery must mark server-confirmed operations before cleanup');
assert.ok(pickup.includes('previous.cents < 100 || previous.cents > 100000'),
  'saved pickup amount must satisfy withdrawal-specific limits');
assert.ok(pickup.includes('setPickupAmount(formatMWD(previous.cents))'),
  'mismatched pending pickup must restore the original amount');
assert.ok(app.includes("if (event === 'SIGNED_IN' || event === 'SIGNED_OUT')"),
  'token refresh and user updates must not reset the current screen');
assert.ok(app.includes('if (pickupBusy || pickupCreateBusyRef.current) return;') &&
  app.includes('pickupCreateBusyRef.current = true;') &&
  app.includes('pickupCreateBusyRef.current = false;'),
  'pickup create must use synchronous guard against rapid double taps');
assert.ok(app.includes('if (!swapQuote?.quoteId || swapBusy || swapConfirmBusyRef.current || swapQuoteBusyRef.current) return;') &&
  app.includes('swapConfirmBusyRef.current = true;') &&
  app.includes('swapConfirmBusyRef.current = false;'),
  'swap confirmation must use synchronous guard');
assert.ok(app.includes('if (pickupCancelBusy || pickupCancelBusyRef.current) return;') &&
  app.includes('pickupCancelBusyRef.current = true;') &&
  app.includes('pickupCancelBusyRef.current = false;'),
  'pickup cancellation must use synchronous guard');
assert.ok(app.includes('if (swapBusy || swapQuoteBusyRef.current || swapConfirmBusyRef.current) return;') &&
  app.includes('swapQuoteBusyRef.current = true;') &&
  app.includes('swapQuoteBusyRef.current = false;'),
  'quote requests must be synchronously guarded');
assert.ok(app.includes('swapConfirmBusyRef.current || swapQuoteBusyRef.current) return;'),
  'confirmation must not race against quote creation');
assert.ok(app.includes('const quoteRevision = ++swapQuoteRevisionRef.current;') &&
  app.includes('quoteRevision === swapQuoteRevisionRef.current && quoteUserId === userId'),
  'late conversion quote responses must be ignored after changes');
assert.ok(app.includes('swapQuoteRevisionRef.current += 1;') &&
  app.includes('setSwapAmount(value);') &&
  app.includes("setSwapFrom(swapFrom === 'COIN' ? 'STABLE' : 'COIN');"),
  'conversion inputs must invalidate old quotes');
assert.ok(app.includes('const refreshRevision = ++accountRefreshRevisionRef.current;') &&
  app.includes('refreshRevision !== accountRefreshRevisionRef.current ||') &&
  app.includes('id !== currentSession.session?.user?.id'),
  'late account refresh must not overwrite a newer or different account');
assert.ok(app.includes('if (refreshRevision === accountRefreshRevisionRef.current) setSyncing(false);') &&
  app.includes('accountRefreshRevisionRef.current += 1;'),
  'stale refresh must not overwrite loading state after account switch');
console.log('PASS: 35 static recovery and idempotency safety checks');
