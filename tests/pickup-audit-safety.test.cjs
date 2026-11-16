const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('database/auditoria_retiros_demo_solo_lectura.sql', 'utf8');

test('pickup audit is read-only and checks private demo orders', () => {
  assert.match(sql, /mwd_pickup_private\.demo_orders/);
  assert.match(sql, /mwd_pickup_private\.demo_order_events/);
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|call|do)\b/i);
});

test('pickup audit covers cancellation consistency and duplicate request ids', () => {
  for (const name of [
    'cancelled_without_exactly_one_event',
    'noncancelled_with_cancel_event',
    'duplicate_request_ids_per_sender',
    'invalid_amount_cents',
    'expiration_not_after_creation'
  ]) assert.ok(sql.includes("'" + name + "'"), name + ' check missing');
  assert.match(sql, /GROUP BY sender_user_id, client_request_id/);
  assert.match(sql, /HAVING count\(\*\) > 1/);
});
