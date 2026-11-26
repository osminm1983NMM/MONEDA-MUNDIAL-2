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
assert.ok(app.includes('status === 400') &&
  app.includes("['22023', 'P0001', '42501'].includes(error?.code)"),
  'Solo HTTP 400 con SQLSTATE explícitamente permitido puede liberar la referencia local');
assert.match(transfer, /if \(response\.error\) \{[\s\S]*?isDefinitiveRpcRejection\(response\.error, response\.status\)[\s\S]*?AsyncStorage\.removeItem\(storageKey\)[\s\S]*?throw response\.error;/,
  'Los rechazos SQL liberan la referencia; los errores inciertos la conservan');
assert.match(transfer, /statusResponse\.data\?\.status === 'processed'[\s\S]*?pendingRef\.current = null/,
  'Solo se limpia un reintento después de confirmar su estado en el servidor');
assert.match(transfer, /if \(!\['ok', 'already_processed'\]\.includes\(response\.data\?\.status\)\s*\|\|[\s\S]*?response\.data\.operation_id[\s\S]*?AsyncStorage\.removeItem\(storageKey\)[\s\S]*?pendingRef\.current = null/,
  'Solo se limpia la referencia tras una respuesta RPC confirmada');
assert.match(transfer, /AsyncStorage\.setItem\(storageKey, JSON\.stringify\(pending\)\)/,
  'La referencia debe persistirse antes de la transferencia');
assert.match(transfer, /p_request_id:\s*requestId/, 'La misma clave persistida debe llegar a la RPC');
assert.ok(app.includes('&& !requiresReview') && app.includes('reconciliaci[oó]n'),
  'Los conflictos idempotentes y de conciliación deben conservar la referencia para revisión');
const swapConfirm = section('async function confirmSwap(expectedQuoteId) {', 'async function recoverPendingPickup(');
const definitiveQuoteError = swapConfirm.indexOf('if (isDefinitiveRpcRejection(error, status))');
const uncertainQuoteError = swapConfirm.indexOf('throw error;', definitiveQuoteError);
assert.ok(definitiveQuoteError >= 0 && uncertainQuoteError > definitiveQuoteError &&
  swapConfirm.slice(definitiveQuoteError, uncertainQuoteError).includes('swapQuoteRef.current = null;') &&
  swapConfirm.slice(definitiveQuoteError, uncertainQuoteError).includes('Cotización rechazada'),
  'Solo un rechazo SQL definitivo debe invalidar la cotización; los errores inciertos deben conservarla');

const prepare = section('function prepareOperation(type) {', 'async function logout()');
assert.match(prepare, /samePending/, 'Falta tratamiento de solicitud incierta');
assert.match(prepare, /wallet\.balance_cents && !samePending/, 'Reintento bloqueado por saldo local');
const refresh = section('async function refreshAccount(id = userId) {', 'async function authenticate(action) {');
assert.match(refresh, /id !== currentUserRef\.current/, 'Posible mezcla de cuentas');
assert.match(refresh, /if \(w\.error\) throw w\.error/, 'Error de billetera ignorado');
assert.match(refresh, /if \(h\.error\) throw h\.error/, 'Error de historial ignorado');
const swap = section('async function confirmSwap(expectedQuoteId) {', 'async function createDemoPickup() {');
assert.match(swap, /already_processed/, 'Conversión no reconoce reintentos');
assert.match(swap, /catch \(syncError\)/, 'Fallo de lectura puede confundirse con fallo de conversión');
const pickup = section('async function createDemoPickup() {', 'async function loadPickupOrders(force = false) {');

assert.match(pickup, /p_request_id:\s*pending\.id/, 'Retiro no reusa la referencia persistida');
assert.ok(sql.length > 100, 'SQL de registro de socios vacío');

assert.match(app, /const isCurrentUser = id => !!id && id === currentUserRef\.current/,
  'Debe existir una guarda de identidad para respuestas asíncronas');
const recovery = section('async function recoverPendingOperation(id = userId) {', 'function changeAmount(value) {');
const sessionGuard = 'if (id !== currentUserRef.current) return;';
const pendingVisible = recovery.indexOf('pendingRef.current = pending;');
const statusLookup = recovery.indexOf("supabase.rpc('mwd_operation_status_demo'");
assert.ok(pendingVisible >= 0 && statusLookup > pendingVisible &&
  recovery.indexOf('setPendingOperation(pending);', pendingVisible) < statusLookup,
  'La referencia pendiente debe quedar visible antes de consultar el servidor');
assert.ok(recovery.indexOf('pendingValidated = true;') >= 0 &&
  recovery.indexOf('pendingRef.current = pending;') > recovery.indexOf('pendingValidated = true;'),
  'Una referencia válida debe seguir visible durante la consulta de estado');
assert.ok(recovery.includes('if (!pendingValidated) {') &&
  recovery.includes('setPendingOperationRecoveryError('),
  'Un error leyendo la referencia local debe bloquear nuevas operaciones');
assert.ok(app.includes('No se pudo revisar la operación anterior') &&
  app.includes('onPress={() => recoverPendingOperation(userId)}'),
  'La pantalla debe ofrecer reintentar la lectura de una referencia local');
const prepareOperation = section('function prepareOperation(type) {', 'async function logout()');
assert.ok(prepareOperation.includes('if (pendingOperationRecoveryError)'),
  'La preparación debe impedir nuevas operaciones con una referencia local dudosa');
assert.ok(app.includes('!!pendingOperationRecoveryError}'),
  'Los accesos a transferencia y aportación deben bloquearse si la referencia no se pudo leer');

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
  pickupRecovery.indexOf('if (!isActive() || !saved) return;', pickupRead) > pickupRead,
  'La recuperación de retiro debe validar la sesión tras leer almacenamiento');
const pickupCreate = section('async function createDemoPickup() {', 'async function loadPickupOrders(force = false) {');
assert.ok(app.includes('const pickupBusyRef = useRef(false);'),
  'El retiro necesita un bloqueo síncrono contra dobles toques');
assert.ok(pickupCreate, 'Falta función de creación de retiro');
const pickupLock = pickupCreate.indexOf('pickupBusyRef.current = token;');
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
  pickupCreate.indexOf('if (!isActive()) return;', removePickup) > removePickup,
  'La limpieza del retiro debe comprobar que la sesión no cambió');
assert.ok(pickupCreate.includes('if (isActive()) {') && pickupCreate.includes('isCurrentUser(actorId) && pickupBusyRef.current === token') &&
  pickupCreate.includes('pickupBusyRef.current = false;') &&
  pickupCreate.includes('setPickupBusy(false);'),
  'Una respuesta tardía de retiro no debe cambiar el estado de carga de otra cuenta');

const asyncAccountSections = [
  ['async function executeOperation(type, cents, code = \'\') {', 'function prepareOperation(type) {'],
  ['async function loadSwapWallet() {', 'async function requestSwapQuote() {'],
  ['async function requestSwapQuote() {', 'async function confirmSwap(expectedQuoteId) {'],
  ['async function confirmSwap(expectedQuoteId) {', 'async function createDemoPickup() {'],
  ['async function createDemoPickup() {', 'async function loadPickupOrders(force = false) {'],
  ['async function loadPickupOrders(force = false) {', 'async function cancelDemoPickup(orderId) {'],
  ['async function cancelDemoPickup(orderId) {', 'function navigate(to) {'],
];
for (const [start, end] of asyncAccountSections) {
  const body = section(start, end);
  assert.match(body, /const actorId = userId/, 'Falta capturar el usuario de la solicitud: ' + start);
  assert.match(body, /if \(!(?:isCurrentUser\(actorId\)|isActive\(\)|isLatest\(\))\) return/,
    'Una respuesta tardía puede actualizar otra cuenta: ' + start);
  assert.ok(
    /finally \{\s*if \((?:isCurrentUser\(actorId\)|isActive\(\)|isLatest\(\))\)/.test(body) ||
      /finally \{\s*endSwapBusy\(busyToken, actorId\);/.test(body),
    'El estado de carga de otra cuenta puede cambiar: ' + start
  );
}

assert.ok(app.includes('const pickupOrdersBusyRef = useRef(false);') &&
  app.includes('const pickupCancelBusyRef = useRef(false);'),
  'Las lecturas y cancelaciones de retiros necesitan bloqueos síncronos');
assert.match(app, /pickupOrdersBusyRef\.current = false;\s*pickupCancelBusyRef\.current = false;/,
  'Los bloqueos de retiro deben reiniciarse al cambiar de cuenta');
const pickupOrders = section('async function loadPickupOrders(force = false) {', 'async function cancelDemoPickup(orderId) {');
assert.ok(pickupOrders.indexOf('pickupOrdersBusyRef.current = token;') >= 0 &&
  pickupOrders.indexOf('pickupOrdersBusyRef.current = token;') < pickupOrders.indexOf("supabase.rpc('mwd_pickup_my_orders_demo'"),
  'La consulta de retiros debe bloquear dobles toques antes de llamar al servidor');
assert.match(pickupOrders, /finally \{\s*if \(isLatest\(\)\) \{\s*pickupOrdersBusyRef\.current = false;/,
  'Una consulta antigua no debe liberar el bloqueo de otra cuenta');
const cancelPickup = section('async function cancelDemoPickup(orderId) {', 'function navigate(to) {');
assert.ok(cancelPickup.includes('pickupCancelBusyRef.current) return') &&
  cancelPickup.indexOf('pickupCancelBusyRef.current = token;') >= 0 &&
  cancelPickup.indexOf('pickupCancelBusyRef.current = token;') < cancelPickup.indexOf("supabase.rpc('mwd_pickup_cancel_demo'"),
  'La cancelación de retiro debe bloquear dobles toques antes de la RPC');
assert.match(cancelPickup, /finally \{\s*if \(isActive\(\)\) \{\s*pickupCancelBusyRef\.current = false;/,
  'Una cancelación antigua no debe liberar el bloqueo de otra cuenta');

assert.ok(pickupRecovery.includes('isCurrentUser(id) && pickupBusyRef.current === token'), 'La recuperación solo puede liberar su propio bloqueo');
assert.ok(pickupOrders.includes('isCurrentUser(actorId) && pickupOrdersBusyRef.current === token'), 'La consulta solo puede publicar la respuesta vigente');
assert.ok(cancelPickup.includes('isCurrentUser(actorId) && pickupCancelBusyRef.current === token'), 'La cancelación solo puede liberar su propio bloqueo');
assert.ok(cancelPickup.includes('await loadPickupOrders(true);'), 'La cancelación confirmada debe reemplazar una consulta anterior');
console.log('PASS: barreras estáticas de reintentos, sesiones, lectura y RPC DEMO');
console.log('NO CERTIFICA: concurrencia, RLS real, contabilidad, APK ni pagos reales');
