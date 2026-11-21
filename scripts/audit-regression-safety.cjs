// Pruebas estáticas de seguridad e idempotencia; sin red ni acceso a Supabase.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
const sql = fs.readFileSync('database/mwd_secure_partner_registry_demo.sql', 'utf8');
function section(start, end) {
  const a = app.indexOf(start);
  assert.ok(a >= 0, 'No se encuentra: ' + start);
  const b = app.indexOf(end, a + start.length);
  assert.ok(b > a, 'No se encuentra el fin de ' + start);
  return app.slice(a, b);
}
const transfer = section('async function executeOperation(type, cents, code = \'\') {', 'function prepareOperation(type) {');
assert.match(transfer, /p_request_id:\s*requestId/, 'Transferencia sin ID idempotente');
assert.match(transfer, /already_processed/, 'No se reconoce reintento procesado');
assert.match(transfer, /if \(response\.error\) throw response\.error/, 'No se verifica el error de RPC');
assert.match(transfer, /statusResponse\.data\?\.status === 'processed'[\s\S]*?pendingRef\.current = null/,
  'Solo se limpia un reintento después de confirmar su estado en el servidor');
assert.match(transfer, /if \(!\['ok', 'already_processed'\]\.includes\(response\.data\?\.status\)\)[\s\S]*?AsyncStorage\.removeItem\(storageKey\)[\s\S]*?pendingRef\.current = null/,
  'Solo se limpia la referencia tras una respuesta RPC confirmada');
assert.match(transfer, /AsyncStorage\.setItem\(storageKey, JSON\.stringify\(pending\)\)/,
  'La referencia debe persistirse antes de la transferencia');
assert.match(transfer, /p_request_id:\s*requestId/, 'La misma clave persistida debe llegar a la RPC');
const prepare = section('function prepareOperation(type) {', 'async function logout()');
assert.match(prepare, /samePending/, 'Falta tratamiento de solicitud incierta');
assert.match(prepare, /wallet\.balance_cents && !samePending/, 'Reintento bloqueado por saldo local');
const refresh = section('async function refreshAccount(id = userId) {', 'async function authenticate(action) {');
assert.match(refresh, /id !== currentUserRef\.current/, 'Posible mezcla de cuentas');
assert.match(refresh, /if \(w\.error\) throw w\.error/, 'Error de billetera ignorado');
assert.match(refresh, /if \(h\.error\) throw h\.error/, 'Error de historial ignorado');
const swap = section('async function confirmSwap() {', 'async function createDemoPickup() {');
assert.match(swap, /already_processed/, 'Conversión no reconoce reintentos');
assert.match(swap, /catch \(syncError\)/, 'Fallo de lectura puede confundirse con fallo de conversión');
const pickup = section('async function createDemoPickup() {', 'async function loadPickupOrders() {');
assert.match(pickup, /p_request_id:\s*requestId/, 'Retiro sin ID idempotente');
assert.match(pickup, /pickupPendingRef\.current\.id/, 'Retiro no conserva ID');
assert.ok(sql.length > 100, 'SQL de registro de socios vacío');
console.log('PASS: barreras estáticas de reintentos, sesiones, lectura y RPC DEMO');
console.log('NO CERTIFICA: concurrencia, RLS real, contabilidad, APK ni pagos reales');
