const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
function body(start,end) { const a=source.indexOf(start), b=source.indexOf(end,a); assert.ok(a>=0&&b>a);return source.slice(a,b); }
test('successful create clears only the saved creation request',()=>{
 const s=body('async function create(cents)', 'async function transition(next)');
 assert.match(s,/await clearPending\(AsyncStorage, userId, pendingCreate\.current\.requestId\)/);
 assert.doesNotMatch(s,/clearPending\(AsyncStorage, userId, pendingTransition\.current\.requestId\)/);
 assert.ok(s.indexOf('data.redeemable !== false')<s.indexOf('await clearPending'));
});
test('successful transition clears its own saved request before dropping in-memory ref',()=>{
 const s=body('async function transition(next)', 'async function loadRecent()');
 assert.match(s,/await clearPending\(AsyncStorage, userId, pendingTransition\.current\.requestId\);\s*setOrder\(\{ id: data\.id, status: data\.status \}\);\s*pendingTransition\.current = null/);
 assert.ok(s.indexOf('data.redeemable !== false')<s.indexOf('await clearPending'));
});

test('creation and transition update visible state only after durable cleanup',()=>{
 const create=body('async function create(cents)','async function transition(next)');
 const transition=body('async function transition(next)','async function loadRecent()');
 for(const section of [create,transition]) {
  assert.ok(section.indexOf('await clearPending(AsyncStorage') < section.indexOf('setOrder({ id: data.id, status: data.status })'));
 }
});

test('transition requires exact target status before durable cleanup',()=>{
 const section=body('async function transition(next)','async function loadRecent()');
 assert.match(section,/data\.id !== order\.id \|\| data\.status !== next/);
 assert.ok(section.indexOf('data.status !== next') < section.indexOf('await clearPending(AsyncStorage'));
});
