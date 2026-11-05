// Pruebas estáticas de protección (sin conexión ni transferencias).
// Ejecutar desde la raíz: node --test tests/security-static.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
const expo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;

test('APK de laboratorio aislada', () => {
  assert.equal(eas.build.recoveryLab.android.buildType, 'apk');
  assert.equal(eas.build.recoveryLab.distribution, 'internal');
  assert.equal(expo.android.package, 'com.monedamundial.app.recoverylab');
});
test('la referencia pendiente pertenece a cada usuario', () => {
  assert.match(app, /mwd_pending_\$\{userId\}/);
  assert.match(app, /item\.userId === userId/);
});
test('la referencia se guarda antes de llamar a Supabase', () => {
  const start = app.indexOf('async function executeOperation');
  const end = app.indexOf('function prepareOperation', start);
  const fn = app.slice(start, end);
  const storageIndex = fn.indexOf('AsyncStorage.setItem');
  const rpcIndex = fn.indexOf("supabase.rpc('mwd_transfer_demo'");
  assert.ok(start >= 0 && end > start, 'Debe existir executeOperation');
  assert.ok(storageIndex >= 0, 'Debe persistir la operación');
  assert.ok(rpcIndex >= 0, 'Debe existir la llamada RPC');
  assert.ok(storageIndex < rpcIndex, 'Debe guardar antes de enviar');
});
test('las transferencias repetidas reutilizan el identificador', () => {
  const start = app.indexOf('async function retryPending');
  const end = app.indexOf('async function executeOperation', start);
  assert.match(app.slice(start, end), /p_request_id: item\.id/);
});
test('cambio de sesión limpia estado local', () => {
  assert.match(app, /busyRef\.current = false;\s*setBusy\(false\);\s*setRecovering\(false\);\s*pendingRef\.current = null/);
});
test('cierre de sesión bloqueado durante operación o recuperación', () => {
  assert.match(app, /if \(busyRef\.current \|\| recovering \|\| pendingLoading\)/);
});
test('respuestas tardías no limpian el estado de otra cuenta', () => {
  assert.match(app, /if \(activeUserRef\.current === item\.userId\) \{\s*busyRef\.current = false/);
  assert.match(app, /if \(activeUserRef\.current === userId\) \{\s*busyRef\.current = false/);
});
test('sin funciones de pago real en esta pantalla', () => {
  assert.match(app, /SOLO DEMOSTRACIÓN • SIN DINERO REAL/);
});

test('las consultas de saldo ignoran respuestas de otra sesión', () => {
  assert.match(app, /activeUserRef\.current !== id \|\| sequence !== refreshSequenceRef\.current/);
});
test('la recuperación consulta el estado de la solicitud original', () => {
  const start = app.indexOf('async function recoverPending');
  const end = app.indexOf('async function retryPending', start);
  const fn = app.slice(start, end);
  assert.match(fn, /mwd_operation_status_demo/);
  assert.match(fn, /p_request_id: item\.id/);
  assert.match(fn, /activeUserRef\.current !== item\.userId/);
});
test('los mensajes de error de operaciones se restringen al usuario activo', () => {
  assert.match(app, /if \(activeUserRef\.current === userId\) message\('Operación no confirmada'/);
  assert.match(app, /if \(activeUserRef\.current === item\.userId\) message\('Reintento sin confirmar'/);
});

test('si cambia la cuenta después de guardar, no se envía la transferencia', () => {
  const start = app.indexOf('async function executeOperation');
  const end = app.indexOf('function prepareOperation', start);
  assert.ok(start >= 0 && end > start);
  const fn = app.slice(start, end);
  const storage = fn.indexOf('await AsyncStorage.setItem');
  const sessionGuard = fn.indexOf('if (activeUserRef.current !== item.userId) return;');
  const rpc = fn.indexOf("supabase.rpc('mwd_transfer_demo'");
  assert.ok(storage >= 0 && sessionGuard > storage && rpc > sessionGuard);
});
