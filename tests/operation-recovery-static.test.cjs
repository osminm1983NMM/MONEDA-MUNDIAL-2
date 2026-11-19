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
console.log('PASS: 12 static recovery and idempotency safety checks');
