// Verificación estática del flujo de reintentos de remesas ficticias.
// No llama Supabase, no crea órdenes ni mueve saldos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');

test('retry of pending creation preserves original request id and amount', () => {
  assert.match(source, /pendingCreate\.current\s*=\s*\{\s*cents,\s*requestId:\s*uuid\(\)\s*\}/);
  assert.match(source, /p_request_id:\s*pendingCreate\.current\.requestId/);
  assert.match(source, /p_amount_cents:\s*cents/);
  assert.match(source, /Reintentar solicitud pendiente/);
});

test('retry of pending transition preserves original order, target and request id', () => {
  assert.match(source, /pendingTransition\.current\s*=\s*\{\s*id:\s*order\.id,\s*next,\s*requestId:\s*uuid\(\)\s*\}/);
  assert.match(source, /p_request_id:\s*pendingTransition\.current\.requestId/);
  assert.match(source, /p_new_status:\s*next/);
  assert.match(source, /p_order_id:\s*order\.id/);
  assert.match(source, /Reintentar cambio pendiente/);
});

test('client uses server-returned status instead of assuming requested state succeeded', () => {
  assert.match(source, /setOrder\(\{\s*id:\s*data\.id,\s*status:\s*data\.status\s*\}\)/);
  assert.match(source, /data\.already_processed\s*\?\s*'Reintento reconocido\.'/);
});
