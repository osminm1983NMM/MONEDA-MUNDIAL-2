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
  assert.ok(fn.indexOf('AsyncStorage.setItem') >= 0);
  assert.ok(fn.indexOf('AsyncStorage.setItem') < fn.indexOf("supabase.rpc('mwd_transfer_demo'"));
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
