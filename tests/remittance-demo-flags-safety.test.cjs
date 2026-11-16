const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');

test('creation and transition both reject RPC replies without explicit demo-only flags', () => {
  const guard = /data\.real_payments_enabled !== false \|\| data\.redeemable !== false/g;
  assert.equal([...source.matchAll(guard)].length, 2);
  assert.equal((source.match(/Respuesta insegura: esta pantalla solo admite operaciones ficticias/g) || []).length, 2);
});

test('demo-only guards run before state is accepted', () => {
  for (const functionName of ['create', 'transition']) {
    const start = source.indexOf('async function ' + functionName + '(');
    const next = source.indexOf('\n  async function ', start + 1);
    const section = source.slice(start, next < 0 ? source.indexOf('\n  const ask =', start) : next);
    assert.ok(section.indexOf('data.real_payments_enabled !== false') >= 0);
    assert.ok(section.indexOf('data.real_payments_enabled !== false') < section.indexOf('setOrder({ id: data.id, status: data.status })'));
  }
});
