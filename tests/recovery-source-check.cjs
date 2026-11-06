const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
function check(name, condition) {
  assert.ok(condition, name);
  console.log('OK:', name);
}
const operation = app.split('async function executeOperation(')[1]?.split('function prepareOperation(')[0];
assert.ok(operation, 'executeOperation exists');
check('pending identifier is saved before network RPC',
  operation.indexOf("AsyncStorage.setItem('mwd-demo-pending-' + userId") >= 0 &&
  operation.indexOf("AsyncStorage.setItem('mwd-demo-pending-' + userId") < operation.indexOf("supabase.rpc('mwd_transfer_demo'"));
check('storage failure aborts network request',
  /catch \(storageError\)[\s\S]*?return message\('No se envió la operación'/.test(operation));
check('pending payload mismatch blocks new request',
  operation.includes('if (pending && (pending.type !== type || pending.cents !== cents || pending.code !== code))'));
check('confirmed result is checked before clearing local recovery record',
  operation.indexOf("includes(response.data?.status)") < operation.indexOf("AsyncStorage.removeItem('mwd-demo-pending-' + userId"));
check('failed local cleanup is reported separately', operation.includes('catch (cleanupError)'));
check('user-scoped recovery', app.includes("AsyncStorage.getItem('mwd-demo-pending-' + userId)"));
check('unreadable recovery blocks new operations', app.includes('setPendingReady(!recoveryFailed)'));
check('pending amount changes are blocked', /function changeAmount\(value\) \{\s*if \(pendingRef.current\)/.test(app));
check('pending recipient changes are blocked', /function changeRecipient\(value\) \{\s*if \(pendingRef.current\)/.test(app));
check('pending navigation is blocked', /function navigate\(to\) \{\s*if \(!pendingReady\)[\s\S]*?if \(pendingRef.current\)/.test(app));

check('contribution type matches recovery', app.includes("!['transfer', 'contribution'].includes(pending.type)") && app.includes("prepareOperation('contribution')"));
check('swap numeric regex is not double escaped', !app.includes('\\\\d*'));
check('logout is blocked while a pending operation is unresolved',
  /async function logout\(\) \{[\s\S]*?if \(pendingRef.current\)/.test(app));
console.log('All source invariants passed. Functional tests remain necessary.');
