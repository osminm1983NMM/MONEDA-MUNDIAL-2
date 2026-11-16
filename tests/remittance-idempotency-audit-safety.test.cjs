const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('database/auditoria_remesas_idempotencia_solo_lectura.sql', 'utf8');
const executable = sql.replace(/--[^\n]*/g, '');

test('remittance idempotency audit remains read-only', () => {
  const withoutStrings = executable.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(withoutStrings, /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|call|do)\b/i);
  assert.match(executable, /mwd_remittance_demo_private\.orders/);
  assert.match(executable, /mwd_remittance_demo_private\.events/);
});

test('remittance idempotency audit covers three duplicate scenarios', () => {
  for (const name of ['duplicate_transition_request_ids', 'duplicate_simulated_completions', 'duplicate_creation_requests']) {
    assert.ok(executable.includes("'" + name + "'"), name + ' check missing');
  }
  assert.match(executable, /GROUP BY order_id, request_id HAVING count\(\*\) > 1/);
  assert.match(executable, /GROUP BY created_by, request_id HAVING count\(\*\) > 1/);
});
