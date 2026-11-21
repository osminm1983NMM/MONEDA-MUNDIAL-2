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

assert.match(pickup, /p_request_id:\s*pending\.id/, 'Retiro no reusa la referencia persistida');
assert.ok(sql.length > 100, 'SQL de registro de socios vacío');

assert.match(app, /const isCurrentUser = id => !!id && id === currentUserRef\.current/,
  'Debe existir una guarda de identidad para respuestas asíncronas');
const recovery = section('async function recoverPendingOperation(id = userId) {', 'function changeAmount(value) {');
const sessionGuard = 'if (id !== currentUserRef.current) return;';
const storageRead = recovery.indexOf('await AsyncStorage.getItem(storageKey);');
assert.ok(storageRead >= 0 && recovery.indexOf(sessionGuard, storageRead) > storageRead,
  'La recuperación debe validar la sesión después de leer el almacenamiento');
const storageDelete = recovery.indexOf('await AsyncStorage.removeItem(storageKey);');
assert.ok(storageDelete >= 0 && recovery.indexOf(sessionGuard, storageDelete) > storageDelete,
  'La recuperación debe validar la sesión después de borrar la referencia confirmada');
const refreshAfterRecovery = recovery.indexOf('await refreshAccount(id);');
assert.ok(refreshAfterRecovery >= 0 &&
  recovery.indexOf(sessionGuard, refreshAfterRecovery) > refreshAfterRecovery &&
  recovery.indexOf('setSyncNotice', refreshAfterRecovery) > recovery.indexOf(sessionGuard, refreshAfterRecovery),
  'La recuperación no debe mostrar avisos tardíos en otra cuenta');

const pickupRecovery = section('async function recoverPendingPickup(id = userId) {', 'async function createDemoPickup() {');
const pickupRead = pickupRecovery.indexOf('await AsyncStorage.getItem(pendingPickupStorageKey(id));');
assert.ok(pickupRead >= 0 &&
  pickupRecovery.indexOf('if (!isCurrentUser(id) || !saved) return;', pickupRead) > pickupRead,
  'La recuperación de retiro debe validar la sesión tras leer almacenamiento');
const pickupCreate = section('async function createDemoPickup() {', 'async function loadPickupOrders() {');
assert.match(app, /const pickupBusyRef = useRef\\(false\\)/,
  'El retiro necesita un bloqueo síncrono contra dobles toques');
assert.ok(pickupCreate, 'Falta función de creación de retiro');
const pickupLock = pickupCreate.indexOf('pickupBusyRef.current = true;');
const pickupFirstAwait = pickupCreate.indexOf('await ');
assert.ok(pickupLock >= 0 && pickupFirstAwait > pickupLock,
  'El bloqueo de retiro debe activarse antes de cualquier espera asíncrona');
assert.ok(pickupCreate.includes('if (pickupBusyRef.current || pickupPendingError) return;'),
  'El segundo toque debe detenerse usando la referencia síncrona');
const persistPickup = pickupCreate.indexOf('await AsyncStorage.setItem(storageKey, JSON.stringify(pending));');
const sendPickup = pickupCreate.indexOf("supabase.rpc('mwd_pickup_create_demo'");
assert.ok(persistPickup >= 0 && sendPickup > persistPickup,
  'La referencia de retiro debe persistirse antes de la RPC');
assert.ok(pickupCreate.includes('p_request_id: pending.id'),
  'La RPC de retiro debe usar la misma referencia recuperada');
const removePickup = pickupCreate.indexOf('await AsyncStorage.removeItem(storageKey);');
assert.ok(removePickup >= 0 &&
  pickupCreate.indexOf('if (!isCurrentUser(actorId)) return;', removePickup) > removePickup,
  'La limpieza del retiro debe comprobar que la sesión no cambió');
assert.ok(pickupCreate.includes('if (isCurrentUser(actorId)) {') &&
  pickupCreate.includes('pickupBusyRef.current = false;') &&
  pickupCreate.includes('setPickupBusy(false);'),
  'Una respuesta tardía de retiro no debe cambiar el estado de carga de otra cuenta');

const asyncAccountSections = [
  ['async function executeOperation(type, cents, code = \'\') {', 'function prepareOperation(type) {'],
  ['async function loadSwapWallet() {', 'async function requestSwapQuote() {'],
  ['async function requestSwapQuote() {', 'async function confirmSwap() {'],
  ['async function confirmSwap() {', 'async function createDemoPickup() {'],
  ['async function createDemoPickup() {', 'async function loadPickupOrders() {'],
  ['async function loadPickupOrders() {', 'async function cancelDemoPickup(orderId) {'],
  ['async function cancelDemoPickup(orderId) {', 'function navigate(to) {'],
];
for (const [start, end] of asyncAccountSections) {
  const body = section(start, end);
  assert.match(body, /const actorId = userId/, 'Falta capturar el usuario de la solicitud: ' + start);
  assert.match(body, /if \(!isCurrentUser\(actorId\)\) return/,
    'Una respuesta tardía puede actualizar otra cuenta: ' + start);
  assert.match(body, /finally \{\s*if \(isCurrentUser\(actorId\)\)/,
    'El estado de carga de otra cuenta puede cambiar: ' + start);
}

console.log('PASS: barreras estáticas de reintentos, sesiones, lectura y RPC DEMO');
console.log('NO CERTIFICA: concurrencia, RLS real, contabilidad, APK ni pagos reales');
