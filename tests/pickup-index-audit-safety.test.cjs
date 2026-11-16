const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('database/auditoria_indices_retiros_demo_solo_lectura.sql', 'utf8');
const executable = sql.replace(/--[^\n]*/g, '');

test('index audit remains read-only', () => {
  assert.match(executable, /FROM pg_catalog\.pg_indexes/);
  assert.doesNotMatch(executable, /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|call|do)\b/i);
});

test('index audit verifies unique definitions and exact column groups', () => {
  assert.match(executable, /CREATE UNIQUE INDEX/);
  for (const columns of [
    '(sender_user_id, client_request_id)',
    '(pickup_code_sha256)',
    '(id)'
  ]) assert.ok(executable.includes(columns), 'Missing expected index columns: ' + columns);
  for (const index of [
    'demo_orders_sender_user_id_client_request_id_key',
    'demo_orders_pickup_code_sha256_key',
    'demo_orders_pkey',
    'demo_order_events_pkey'
  ]) assert.ok(executable.includes(index), 'Missing expected index: ' + index);
  assert.match(executable, /missing_or_changed/);
});
