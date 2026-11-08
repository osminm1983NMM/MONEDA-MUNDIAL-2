// Pruebas estáticas de protecciones de órdenes ficticias; sin red ni base de datos.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

const checks = [
  ['Creación bloquea pulsaciones simultáneas', () => {
    assert.match(app, /async function createDemoPickup\(\)\s*\{[\s\S]*?pickupCreateInFlightRef\.current/);
    assert.match(app, /pickupCreateInFlightRef\.current = true/);
    assert.match(app, /pickupCreateInFlightRef\.current = false/);
  }],
  ['Cancelación bloquea pulsaciones simultáneas', () => {
    assert.match(app, /async function cancelDemoPickup\(orderId\)[\s\S]*?pickupCancelInFlightRef\.current/);
    assert.match(app, /pickupCancelInFlightRef\.current = true/);
    assert.match(app, /pickupCancelInFlightRef\.current = false/);
  }],
  ['Órdenes antiguas no reemplazan consultas recientes', () => {
    assert.match(app, /const requestSequence = \+\+pickupOrdersSequenceRef\.current/);
    assert.match(app, /requestSequence === pickupOrdersSequenceRef\.current\) setPickupOrders\(data\)/);
  }],
  ['Cambio de cuenta invalida consultas y limpia órdenes', () => {
    assert.match(app, /pickupOrdersSequenceRef\.current \+= 1;\s*setPickupOrders\(\[\]\)/);
    assert.match(app, /setPickupResult\(null\)/);
  }],
  ['Cancelación valida la cuenta antes de notificar', () => {
    assert.match(app, /if \(authUserRef\.current !== requestedUserId\) return;\s*message\('Orden ficticia'/);
  }],
  ['Cuenta activa obligatoria antes de crear, consultar o cancelar', () => {
    for (const signature of [
      'async function createDemoPickup()',
      'async function loadPickupOrders()',
      'async function cancelDemoPickup(orderId)',
    ]) {
      const start = app.indexOf(signature);
      assert.ok(start !== -1, 'Falta ' + signature);
      assert.ok(app.slice(start, start + 260).includes('authUserRef.current !== userId'),
        'Falta validación de sesión en ' + signature);
    }
  }],
  ['Error de creación no afirma que la orden haya fallado', () => {
    const start = app.indexOf('async function createDemoPickup()');
    const end = app.indexOf('async function loadPickupOrders()', start);
    assert.ok(start !== -1 && end > start, 'Falta la función de creación');
    const creation = app.slice(start, end);
    assert.match(creation, /La solicitud pudo haberse registrado/);
    assert.match(creation, /Consulta Mis retiros antes de intentar crear otra orden/);
    assert.doesNotMatch(creation, /Orden ficticia no creada/);
  }],
  ['Error de cancelación no asegura falsamente que falló', () => {
    const start = app.indexOf('async function cancelDemoPickup(orderId)');
    const end = app.indexOf('function navigate(to)', start);
    assert.ok(start !== -1 && end > start, 'Falta la función de cancelación');
    const cancellation = app.slice(start, end);
    assert.match(cancellation, /La orden pudo haberse cancelado/);
    assert.match(cancellation, /Consulta Mis retiros antes de intentarlo nuevamente/);
    assert.doesNotMatch(cancellation, /No se pudo cancelar/);
  }],
  ['Cambio de cuenta reinicia la carga de órdenes', () => {
    assert.match(app, /pickupOrdersSequenceRef\.current \+= 1;\s*setPickupOrders\(\[\]\);\s*setPickupOrdersBusy\(false\)/);
  }],
];
let failed = 0;
for (const [label, check] of checks) {
  try { check(); console.log('OK:', label); }
  catch (error) { failed++; console.error('ERROR:', label, error.message); }
}
if (failed) process.exitCode = 1;
else console.log(checks.length + ' verificaciones estáticas aprobadas. No sustituyen pruebas funcionales.');
