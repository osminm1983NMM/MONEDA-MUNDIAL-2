const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');

test('owner restriction protects actions and screen rendering', () => {
  for (const method of ['create', 'transition', 'loadRecent', 'refreshSelected', 'selectRecent']) {
    const start = source.indexOf('async function ' + method + '(');
    assert.ok(start >= 0, method + ' function missing');
    const next = source.indexOf('\n  async function ', start + 1);
    const body = source.slice(start, next < 0 ? source.indexOf('\n  const ask =', start) : next);
    assert.match(body, /adminRole\s*!==\s*'owner'/, method + ' missing owner guard');
  }
  assert.match(source, /if \(adminRole !== 'owner'\) return <Text/);
});

test('unresolved transition prevents conflicting changes while allowing read-only reconciliation', () => {
  assert.match(source, /pendingTransition\.current\.id !== order\.id \|\| pendingTransition\.current\.next !== next/);
  assert.match(source, /current\.status === pendingTransition\.current\.next/);
  assert.match(source, /pendingTransition\.current\) \{/);
});

test('demo corridor and no real payments are explicit in the screen', () => {
  assert.match(source, /p_destination_country:\s*'HN'/);
  assert.match(source, /Origen: Estados Unidos \(US\)/);
  assert.match(source, /Sin dinero real, sin entrega y sin débito MWD/);
});
