// Validación local, sin red ni acceso a Supabase. No modifica datos.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const files = ['package.json', 'app.json', 'App.js'];
for (const file of files) assert.ok(fs.existsSync(file), 'Falta ' + file);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const app = fs.readFileSync('App.js', 'utf8');
assert.ok(pkg.dependencies?.expo, 'Falta Expo');
assert.ok(pkg.dependencies?.['@supabase/supabase-js'], 'Falta cliente Supabase');
assert.ok(config.expo?.android?.package, 'Falta identificador Android');
assert.ok(config.expo?.scheme === 'com.monedamundial.app',
  'Falta el esquema registrado para enlaces de recuperación');
assert.ok(app.includes("flowType: 'pkce'"), 'La recuperación requiere flujo PKCE');
assert.ok(app.includes('resetPasswordForEmail(cleanEmail'), 'Falta solicitar correo de recuperación');
const passwordResetBody = app.split('async function requestPasswordReset() {')[1]?.split('async function saveNewPassword() {')[0];
assert.ok(passwordResetBody, 'Falta flujo de recuperación de contraseña');
const resetEmailLine = passwordResetBody.split(String.fromCharCode(10)).find(line => line.includes('.test(cleanEmail)'));
assert.ok(resetEmailLine, 'Falta validar correo antes de pedir recuperación');
const resetPatternStart = resetEmailLine.indexOf('if (!/') + 'if (!/'.length;
const resetPatternEnd = resetEmailLine.indexOf('/.test(cleanEmail)', resetPatternStart);
assert.ok(resetPatternEnd > resetPatternStart, 'No se pudo leer la validación del correo de recuperación');
const resetEmailPattern = new RegExp(resetEmailLine.slice(resetPatternStart, resetPatternEnd));
for (const value of ['osmin@example.com', 'user.name+test@example.co']) {
  assert.ok(resetEmailPattern.test(value), 'Recuperación rechaza correo válido: ' + value);
}
for (const value of ['no-email', 'user@', '@example.com', '']) {
  assert.ok(!resetEmailPattern.test(value), 'Recuperación acepta correo inválido: ' + value);
}

assert.ok(app.includes('exchangeCodeForSession(code)'), 'Falta intercambiar el código del enlace profundo');
assert.match(app, /codeState\.processed\.has\(code\) \|\| codeState\.inFlight\.has\(code\)/,
  'Un mismo enlace de recuperación no debe intercambiarse dos veces en paralelo');
assert.match(app, /codeState\.inFlight\.add\(code\)/,
  'El código debe bloquear intercambios simultáneos antes de llamar a Supabase');
assert.match(app, /codeState\.processed\.add\(code\)/,
  'El código de recuperación consumido debe quedar registrado durante la sesión');
assert.ok(app.includes("parsed.host !== 'auth' || parsed.pathname !== '/reset-password'"),
  'El receptor debe limitarse al enlace de recuperación esperado');
assert.ok(app.includes("event === 'PASSWORD_RECOVERY'"), 'Falta detectar el evento de recuperación');
assert.ok(app.includes('updateUser({ password: newPassword })'), 'Falta guardar la nueva contraseña');
assert.ok(app.includes("screen === 'CambiarContraseña'"), 'Falta la pantalla para guardar la nueva contraseña');
const savePasswordBody = app.split('async function saveNewPassword() {')[1]?.split('async function recoverPendingOperation(')[0];
assert.ok(savePasswordBody, 'Falta guardar la contraseña nueva');
assert.match(savePasswordBody, /finally \{[\s\S]*?setAuthBusy\(false\);/,
  'El formulario de contraseña debe liberar su estado ocupado aunque cambie la sesión');

assert.ok(config.expo?.extra?.eas?.projectId, 'Falta EAS projectId');
assert.match(app, /créditos ficticios|creditos ficticios/i, 'Falta aviso de créditos ficticios');
assert.match(app, /NO mueve dinero real/i, 'Falta aviso de que no mueve dinero real');
const prohibited = [
  /sb_secret_[A-Za-z0-9_-]+/g,
  /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"][^'"]+['"]/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
for (const [index, pattern] of prohibited.entries()) {
  assert.ok(!pattern.test(app), 'Posible secreto incrustado en App.js (regla ' + (index + 1) + ')');
}

// Regression: conversion input must accept positive decimals and reject malformed text.
const quoteBody = app.split('async function requestSwapQuote() {')[1]?.split('async function confirmSwap() {')[0];
assert.ok(quoteBody, 'Falta función de cotización');
const quoteLine = quoteBody.split('\n').find(line => line.includes("if (!/") && line.includes(".test(normalized)"));
assert.ok(quoteLine, 'Falta validación de cotización');
const start = quoteLine.indexOf('if (!/') + 'if (!/'.length;
const end = quoteLine.indexOf('/.test(normalized)', start);
assert.ok(end > start, 'No se pudo extraer el patrón de cotización');
const quotePattern = new RegExp(quoteLine.slice(start, end));
for (const value of ['1', '10.25', '0.123456', '10000']) {
  assert.ok(quotePattern.test(value), 'Cotización rechaza cantidad válida: ' + value);
}
for (const value of ['1x25', '1,2', '-1', '0.1234567', '1..2', '']) {
  assert.ok(!quotePattern.test(value), 'Cotización acepta cantidad inválida: ' + value);
}


const pickupBody = app.split('async function createDemoPickup() {')[1]?.split('async function loadPickupOrders() {')[0];
assert.ok(pickupBody, 'Falta función de retiro ficticio');
assert.match(pickupBody, /p_request_id:\s*pending\.id/, 'Retiro sin referencia idempotente recuperada');
assert.match(pickupBody, /p_request_id:\s*pending\.id/, 'RPC de retiro sin clave idempotente persistida');
assert.match(pickupBody, /pickupPendingRef\.current = null/, 'Retiro sin limpieza al confirmar');
assert.match(app, /onChangeText=\{setPickupAmount\}/, 'El formulario debe mantener la persistencia del retiro');


const navigationBody = app.split('function navigate(to) {')[1]?.split('  return (')[0];
assert.ok(navigationBody, 'Falta navegación');
assert.ok(!navigationBody.includes('pendingRef.current = null'), 'Navegar no debe perder clave de transferencia incierta');
assert.ok(!navigationBody.includes("setAmount('')"), 'Navegar no debe borrar monto de reintento');
assert.ok(!navigationBody.includes("setRecipientCode('')"), 'Navegar no debe borrar destinatario de reintento');


// Navigation must remain stable during automatic session refresh.
const authBody = app.split('supabase.auth.onAuthStateChange(')[1]?.split('subscription.unsubscribe()')[0];
assert.ok(authBody, 'Falta observador de autenticación');
assert.match(authBody, /event === 'SIGNED_IN' \|\| event === 'SIGNED_OUT'/,
  'No reiniciar navegación por TOKEN_REFRESHED');
assert.match(app, /cents > wallet\.balance_cents && !samePending/,
  'El reintento incierto debe poder consultar al servidor aunque el saldo local sea antiguo');
assert.match(app, /setPickupResult\(data\)/, 'Falta resultado de retiro');
const operationBody = app.split('function prepareOperation(type) {')[1]?.split('async function logout()')[0];
assert.ok(operationBody, 'Falta preparación de operaciones');
assert.match(operationBody, /existingPending\?\.type === type/, 'El reintento debe conservar tipo de operación');
assert.match(operationBody, /existingPending\?\.cents === cents/, 'El reintento debe conservar cantidad');
assert.match(operationBody, /existingPending\?\.code ===/, 'El reintento debe conservar destinatario');
assert.match(operationBody, /pendingOperation/, 'La referencia recuperada debe bloquear otra operación');
assert.match(app, /AsyncStorage\.setItem\(storageKey, JSON\.stringify\(pending\)\)/,
  'La referencia debe guardarse antes de llamar la RPC');
assert.match(app, /recoverPendingOperation\(userId\)/, 'Falta recuperar solicitudes al iniciar sesión');
assert.match(app, /mwd_operation_status_demo/, 'Falta consultar el estado de solicitudes inciertas');
assert.match(app, /result\.kind !== pending\.type/, 'El resultado recuperado debe coincidir con la referencia guardada');



const transferBody = app.split("async function executeOperation(type, cents, code = '') {")[1]?.split('function prepareOperation(type) {')[0];
assert.ok(transferBody, 'Falta ejecutor de transferencias');
assert.match(transferBody, /pendingRef\.current = null/, 'Falta limpieza de solicitud confirmada');
assert.match(app, /executeOperation\(type, cents, type === 'transfer' \? code : ''\)/,
  'Las aportaciones no deben heredar destinatarios de transferencias');
const swapConfirmBody = app.split('async function confirmSwap() {')[1]?.split('async function createDemoPickup() {')[0];
assert.ok(swapConfirmBody, 'Falta confirmación de conversiones');
assert.ok(!swapConfirmBody.includes("return message('Cotización vencida'"),
  'No bloquear reintentos de conversiones que podrían haberse confirmado');
assert.match(swapConfirmBody, /message\('Conversión ficticia'/,
  'Falta aviso de confirmación de conversión');
assert.match(swapConfirmBody, /catch \(syncError\)/,
  'Fallo de actualización posterior no debe confundirse con fallo de conversión');

assert.match(authBody, /authEventReceived = true/, 'El evento de autenticación debe invalidar una respuesta inicial tardía');
assert.match(app, /if \(active && !authEventReceived\) setSession\(data\.session\)/,
  'La sesión inicial tardía no debe sobrescribir un inicio o cierre de sesión reciente');

const refreshBody = app.split('async function refreshAccount(id = userId) {')[1]?.split('async function authenticate(action) {')[0];
assert.ok(refreshBody, 'Falta actualización de cuenta');
assert.match(app, /currentUserRef\.current = userId/, 'Falta identidad actual para descartar respuestas antiguas');
assert.match(refreshBody, /if \(id !== currentUserRef\.current\) return/,
  'No se deben mostrar datos de una cuenta anterior');
assert.match(refreshBody, /if \(id === currentUserRef\.current\) setSyncing\(false\)/,
  'Una solicitud antigua no debe alterar la sincronización de otra cuenta');

const pickupRecovery = app.split('async function recoverPendingPickup(id = userId) {')[1]?.split('async function createDemoPickup() {')[0];
assert.ok(pickupRecovery, 'Falta recuperación de retiros al iniciar sesión');
assert.ok(app.includes('recoverPendingPickup(userId);'), 'Falta recuperar un retiro guardado al iniciar sesión');
assert.ok(app.includes("'mwd_pending_pickup:'"), 'Falta una clave persistente de retiro por usuario');
assert.ok(pickupRecovery.includes('await AsyncStorage.getItem(pendingPickupStorageKey(id))'),
  'La recuperación de retiro debe leer AsyncStorage');
const pickupCreate = app.split('async function createDemoPickup() {')[1]?.split('async function loadPickupOrders() {')[0];
assert.ok(pickupCreate, 'Falta crear/reintentar retiro');
const persistPickup = pickupCreate.indexOf('await AsyncStorage.setItem(storageKey, JSON.stringify(pending));');
const sendPickup = pickupCreate.indexOf("supabase.rpc('mwd_pickup_create_demo'");
assert.ok(persistPickup >= 0 && sendPickup > persistPickup,
  'La referencia de retiro debe persistirse antes de llamar la RPC');
assert.ok(pickupCreate.includes('p_request_id: pending.id'),
  'El retiro debe reusar la referencia persistida');
assert.ok(pickupCreate.indexOf("!['created', 'already_created'].includes(data?.status)") <
  pickupCreate.indexOf('await AsyncStorage.removeItem(storageKey)'),
  'La referencia solo se limpia después de una respuesta confirmada');
assert.ok(app.includes('resumePendingPickup'), 'La pantalla inicial debe permitir reanudar un retiro pendiente');
assert.ok(app.includes('onPress={() => recoverPendingPickup(userId)}'),
  'La pantalla inicial debe permitir reintentar la verificación de un retiro pendiente');
assert.ok(app.includes('editable={!pickupBusy && !pendingPickup && !pickupPendingError}'),
  'No debe permitir cambiar el importe de un retiro pendiente');
console.log('PASS: estructura, configuración Android, advertencia DEMO y comprobación básica de secretos.');
console.log('NOTA: no valida RLS, RPC, transferencias, contabilidad, conexión ni instalación APK.');
