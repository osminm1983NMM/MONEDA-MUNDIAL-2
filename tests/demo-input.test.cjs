// Pruebas locales sin acceso a Supabase ni movimientos de fondos.
// Ejecutar: node --test tests/demo-input.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

// Este patrón debe coincidir con el usado en requestSwapQuote de App.js.
const amountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

test('la expresión de conversiones del código coincide con la validada', () => {
  assert.ok(app.includes('if (!' + amountPattern.toString() + '.test(normalized))'));
});

test('admite importes de hasta seis decimales', () => {
  for (const value of ['1', '10.50', '0.000001', '10000', '1.123456']) {
    assert.equal(amountPattern.test(value), true, value);
  }
});

test('rechaza cantidades mal formadas', () => {
  for (const value of ['', 'abc', '-1', '01.2', '1.2.3', '1.1234567']) {
    assert.equal(amountPattern.test(value), false, value);
  }
});

test('conserva identificador de retiro para reintentos', () => {
  assert.ok(app.includes('const pickupRequestRef = useRef(null);'));
  assert.ok(app.includes('const requestId = pickupRequestRef.current.requestId;'));
  assert.ok(app.includes('pickupRequestRef.current = { cents, requestId: uniqueRequestId() };'));
});

test('limpia identificador cuando se completa o se edita el importe', () => {
  assert.ok(app.includes('setPickupResult(data);\\n      pickupRequestRef.current = null;'.replace('\\n', '\n')));
  assert.ok(app.includes('setPickupAmount(value);\\n                  pickupRequestRef.current = null;'.replace('\\n', '\n')));
});

test('muestra los estados de retiro en español sin confundirlos con pagos reales', () => {
  for (const label of ["pending: 'Pendiente'", "expired: 'Vencida'", "cancelled: 'Cancelada'", "simulated_collected: 'Retiro simulado'"]) {
    assert.ok(app.includes(label), label);
  }
  assert.ok(app.includes('Estado: {pickupStatusLabel(order.status)}'));
  assert.ok(app.includes("'Estado no reconocido'"));
});
