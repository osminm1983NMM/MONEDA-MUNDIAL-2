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

test('limpia información de la cuenta anterior al cambiar de usuario', () => {
  const marker = 'pickupRequestRef.current = null;\\n    swapQuoteRequestRef.current = null;\\n    swapInputVersionRef.current += 1;\\n    pendingRef.current = null;'.replaceAll('\\n', '\n');
  const start = app.indexOf(marker);
  assert.notEqual(start, -1);
  const block = app.slice(start, start + 350);
  for (const clear of ['setWallet(null);', 'setOperations([]);', 'setAdminRole(null);', 'setSwapWallet(null);', 'setSwapQuote(null);', 'setPickupOrders([]);', 'setPickupResult(null);']) {
    assert.ok(block.includes(clear), clear);
  }
  assert.ok(block.includes('refreshAccount(userId);'));
});

test('ignora respuestas de sincronización anteriores a la sesión actual', () => {
  assert.ok(app.includes('const refreshSequenceRef = useRef(0);'));
  assert.ok(app.includes('refreshSequenceRef.current += 1;'));
  assert.ok(app.includes('const requestSequence = ++refreshSequenceRef.current;'));
  assert.ok(app.includes('requestSequence !== refreshSequenceRef.current || id !== sessionData.session?.user?.id'));
  assert.ok(app.includes('if (requestSequence !== refreshSequenceRef.current) return;'));
  assert.ok(app.includes('if (requestSequence === refreshSequenceRef.current) setSyncing(false);'));
});

test('reutiliza el identificador de cotización al reintentar y lo reinicia cuando cambian los datos', () => {
  assert.ok(app.includes('const swapQuoteRequestRef = useRef(null);'));
  assert.ok(app.includes('swapQuoteRequestRef.current = { micro, asset: swapFrom, requestId: uniqueRequestId() };'));
  assert.ok(app.includes('const quoteRequestId = swapQuoteRequestRef.current.requestId;'));
  assert.ok(app.includes('p_client_request_id: quoteRequestId'));
  assert.ok(app.includes('swapQuoteRequestRef.current = null;'));
});

test('descarta cotizaciones anteriores al cambio de moneda o cantidad', () => {
  assert.ok(app.includes('const swapInputVersionRef = useRef(0);'));
  assert.ok(app.includes('const inputVersion = swapInputVersionRef.current;'));
  assert.ok(app.includes('if (inputVersion !== swapInputVersionRef.current) return;'));
  assert.ok(app.includes('swapInputVersionRef.current += 1;'));
});

test('no muestra errores de cotizaciones anteriores y aclara reintentos de retiros', () => {
  assert.ok(app.includes('if (inputVersion === swapInputVersionRef.current) {'));
  assert.ok(app.includes("data.status === 'already_created' && !data.pickupCode"));
  assert.ok(app.includes('El código de prueba no se vuelve a mostrar.'));
});
