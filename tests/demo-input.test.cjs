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
  assert.ok(app.includes('setPickupResult(data);'));
  assert.ok(app.includes('pickupRequestRef.current = null;'));
  assert.ok(app.includes("if (accountSequence !== accountVersionRef.current || authData.session?.user?.id !== accountId) return;"));
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
  assert.ok(app.includes('if (inputVersion !== swapInputVersionRef.current || accountSequence !== accountVersionRef.current) return;'));
  assert.ok(app.includes('swapInputVersionRef.current += 1;'));
});

test('no muestra errores de cotizaciones anteriores y aclara reintentos de retiros', () => {
  assert.ok(app.includes('if (inputVersion === swapInputVersionRef.current && accountSequence === accountVersionRef.current) {'));
  assert.ok(app.includes("data.status === 'already_created' && !data.pickupCode"));
  assert.ok(app.includes('El código de prueba no se vuelve a mostrar.'));
});

test('distingue conversión confirmada de un fallo al actualizar saldo', () => {
  const start = app.indexOf('async function confirmSwap()');
  const end = app.indexOf('async function createDemoPickup()', start);
  const block = app.slice(start, end);
  assert.ok(block.includes("message('Conversión ficticia confirmada'"));
  assert.ok(block.includes("message('Saldo pendiente de actualizar'"));
  assert.ok(block.includes('No la repitas.'));
  assert.ok(block.indexOf("message('Conversión ficticia confirmada'") < block.indexOf("supabase.rpc('mwd_conversion_wallet_demo')"));
});

test('confirma transferencia antes de refrescar saldo e historial', () => {
  const start = app.indexOf('async function executeOperation(');
  const end = app.indexOf('function prepareOperation(', start);
  const block = app.slice(start, end);
  const confirmation = block.indexOf("message('Operación ficticia confirmada'");
  const refresh = block.indexOf('await refreshAccount();');
  assert.ok(confirmation >= 0 && refresh > confirmation);
});

test('navegar no elimina el identificador de una transferencia pendiente', () => {
  const start = app.indexOf('function navigate(to)');
  const end = app.indexOf('  return (', start);
  const block = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.equal(block.includes('pendingRef.current = null;'), false);
  assert.ok(app.includes('pendingRef.current = { type, cents, code, id: uniqueRequestId() };'));
});

test('conserva los campos de una transferencia pendiente al navegar', () => {
  const start = app.indexOf('function navigate(to)');
  const end = app.indexOf('  return (', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('if (!pendingRef.current) {'));
  assert.ok(block.includes("setAmount('');"));
  assert.ok(block.includes("setRecipientCode('');"));
});

test('permite reintentar una operación idéntica aunque haya bajado el saldo', () => {
  const start = app.indexOf('function prepareOperation(type)');
  const end = app.indexOf('function navigate(to)', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const pending = pendingRef.current;'));
  assert.ok(block.includes("pending?.type === type && pending.cents === cents && pending.code === (type === 'transfer' ? code : '')"));
  assert.ok(block.includes('if (!samePending && cents > wallet.balance_cents)'));
});

test('no muestra órdenes de retiro cargadas para otra sesión', () => {
  const start = app.indexOf('async function loadPickupOrders()');
  const end = app.indexOf('async function cancelDemoPickup(', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountId = userId;'));
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('setPickupOrders(data);'));
});

test('no muestra saldos COIN/DIGITAL cargados para otra sesión', () => {
  const start = app.indexOf('async function loadSwapWallet()');
  const end = app.indexOf('async function requestSwapQuote()', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountId = userId;'));
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('setSwapWallet(data);'));
});

test('descarta cotizaciones recibidas después de cambiar de cuenta', () => {
  const start = app.indexOf('async function requestSwapQuote()');
  const end = app.indexOf('async function confirmSwap()', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountId = userId;'));
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('setSwapQuote(data);'));
});

test('protege confirmación y actualización de saldos al cambiar de sesión', () => {
  const start = app.indexOf('async function confirmSwap()');
  const end = app.indexOf('async function createDemoPickup()', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountId = userId;'));
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.includes('refreshedAuth.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('setSwapQuote(null);', block.indexOf("['ok', 'already_processed']")));
});

test('no muestra retiros creados para otra sesión', () => {
  const start = app.indexOf('async function createDemoPickup()');
  const end = app.indexOf('async function loadPickupOrders()', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountId = userId;'));
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('setPickupResult(data);'));
});

test('aportación usa código vacío para reintento idempotente', () => {
  const start = app.indexOf('function prepareOperation(type)');
  const end = app.indexOf('async function executeOperation(', start);
  const block = app.slice(start, end > start ? end : undefined);
  assert.ok(block.includes("const code = type === 'transfer' ? recipientCode.trim().toUpperCase() : '';"));
  assert.ok(block.includes("pending.code === (type === 'transfer' ? code : '')"));
});

test('separa cambios de cuenta de actualizaciones ordinarias de saldos', () => {
  assert.ok(app.includes('const accountVersionRef = useRef(0);'));
  assert.ok(app.includes('accountVersionRef.current += 1;'));
  assert.ok(app.includes('const requestSequence = ++refreshSequenceRef.current;'));
  assert.ok(!app.includes('accountSequence = refreshSequenceRef.current'));
});

test('no muestra cancelación de retiro de una sesión anterior', () => {
  const start = app.indexOf('async function cancelDemoPickup(');
  const end = app.indexOf('function navigate(', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf("message('Orden ficticia'"));
});

test('transferencias y aportaciones no confirman en otra sesión', () => {
  const start = app.indexOf('async function executeOperation(');
  const end = app.indexOf('function prepareOperation(', start);
  const block = app.slice(start, end);
  assert.ok(block.includes('const accountSequence = accountVersionRef.current;'));
  assert.ok(block.includes('authData.session?.user?.id !== accountId'));
  assert.ok(block.indexOf('authData.session?.user?.id !== accountId') < block.indexOf('pendingRef.current = null;'));
  assert.ok(block.includes('if (accountSequence === accountVersionRef.current) setBusy(false);'));
});

test('reinicia indicadores de carga al cambiar de cuenta', () => {
  const start = app.indexOf('accountVersionRef.current += 1;');
  const block = app.slice(start, start + 270);
  for (const setter of ['setBusy(false);', 'setSwapBusy(false);', 'setPickupBusy(false);', 'setPickupOrdersBusy(false);', 'setPickupCancelBusy(false);']) {
    assert.ok(block.includes(setter), setter);
  }
});

test('una transferencia antigua no desbloquea operaciones de la nueva cuenta', () => {
  const start = app.indexOf('async function executeOperation(');
  const end = app.indexOf('function prepareOperation(', start);
  const block = app.slice(start, end);
  assert.ok(app.includes('busyRef.current = null;'));
  assert.ok(block.includes('const operationToken = accountSequence;'));
  assert.ok(block.includes('busyRef.current = operationToken;'));
  assert.ok(block.includes('if (busyRef.current === operationToken) {'));
  assert.ok(!block.includes('busyRef.current = false;'));
});

test('identifica claramente destinatario y cantidad en transferencias y aportaciones', () => {
  assert.ok(app.includes('accessibilityLabel="Código MWD del destinatario"'));
  assert.ok(app.includes('accessibilityLabel="Cantidad de MWD para transferir"'));
  assert.ok(app.includes('accessibilityLabel="Cantidad de MWD para aportar"'));
  assert.ok(app.includes("message('Campo equivocado'"));
  assert.ok(app.includes('Para enviar créditos usa Transferir'));
});

test('confirmación pendiente no ejecuta transferencia con una cuenta distinta', () => {
  const prepare = app.slice(app.indexOf('function prepareOperation('), app.indexOf('async function logout('));
  const execute = app.slice(app.indexOf('async function executeOperation('), app.indexOf('function prepareOperation('));
  assert.ok(prepare.includes('const confirmedAccountId = userId;'));
  assert.ok(prepare.includes('const confirmedAccountVersion = accountVersionRef.current;'));
  assert.ok(prepare.includes('confirmedAccountVersion !== accountVersionRef.current'));
  assert.ok(prepare.includes('executeOperation(type, cents, code, confirmedAccountId, confirmedAccountVersion)'));
  assert.ok(execute.includes('accountId !== expectedAccountId || accountSequence !== expectedAccountVersion'));
});

const vm = require('node:vm');

test('ejecuta conversión real de importes y rechaza códigos MWD', () => {
  const start = app.indexOf('function amountToCents(');
  const end = app.indexOf('function uniqueRequestId(', start);
  assert.ok(start >= 0 && end > start);
  const convert = vm.runInNewContext('const LIMIT_CENTS = 100000000; ' + app.slice(start, end) + '; amountToCents');
  for (const [input, expected] of [['1', 100], ['1.00', 100], ['0.01', 1], ['12,34', 1234], ['1000000', 100000000], ['0', null], ['-1', null], ['1.001', null], ['1000000.01', null], ['MWD-78FC9E21E886422B', null], ['', null]]) {
    assert.equal(convert(input), expected, input);
  }
});

test('las conversiones no muestran errores ni modifican carga de una sesión anterior', () => {
  const quote = app.slice(app.indexOf('async function requestSwapQuote('), app.indexOf('async function confirmSwap('));
  const confirm = app.slice(app.indexOf('async function confirmSwap('), app.indexOf('async function createDemoPickup('));
  assert.ok(quote.includes('if (accountSequence === accountVersionRef.current) setSwapBusy(false);'));
  assert.ok(confirm.includes('if (accountSequence === accountVersionRef.current) setSwapBusy(false);'));
  assert.ok(confirm.includes("if (accountSequence === accountVersionRef.current) message('Conversión no confirmada'"));
  assert.ok(confirm.includes("if (accountSequence === accountVersionRef.current) message('Saldo pendiente de actualizar'"));
});

test('confirmar una cotización anterior conserva cambios nuevos del formulario', () => {
  const confirm = app.slice(app.indexOf('async function confirmSwap('), app.indexOf('async function createDemoPickup('));
  assert.ok(confirm.includes('const inputVersion = swapInputVersionRef.current;'));
  const guarded = confirm.slice(confirm.indexOf('if (inputVersion === swapInputVersionRef.current) {'));
  assert.ok(guarded.indexOf('setSwapQuote(null);') < guarded.indexOf('setSwapAmount(\'\');'));
  assert.ok(guarded.indexOf('setSwapAmount(\'\');') < guarded.indexOf("message('Conversión ficticia confirmada'"));
});

test('ejecuta parser de conversión de seis decimales con límites exactos', () => {
  const start = app.indexOf('function swapAmountToMicro(');
  const end = app.indexOf('function uniqueRequestId(', start);
  assert.ok(start >= 0 && end > start);
  const parse = vm.runInNewContext(app.slice(start, end) + '; swapAmountToMicro');
  for (const [input, expected] of [['1', 1000000], ['1.000001', 1000001], ['2,5', 2500000], ['10000', 10000000000], ['0', null], ['0.999999', null], ['10000.000001', null], ['1.0000001', null], ['1e3', null], ['MWD-78FC9E21E886422B', null], ['', null]]) {
    assert.equal(parse(input), expected, input);
  }
});

test('confirmación de transferencia caduca al editar monto o destinatario', () => {
  const prepare = app.slice(app.indexOf('function prepareOperation('), app.indexOf('async function logout('));
  const edits = app.slice(app.indexOf('function changeAmount('), app.indexOf('async function executeOperation('));
  assert.ok(app.includes('const operationInputVersionRef = useRef(0);'));
  assert.ok(edits.includes('function changeAmount(value) {\n    operationInputVersionRef.current += 1;'));
  assert.ok(edits.includes('function changeRecipient(value) {\n    operationInputVersionRef.current += 1;'));
  assert.ok(prepare.includes('const confirmedInputVersion = operationInputVersionRef.current;'));
  assert.ok(prepare.includes('confirmedInputVersion !== operationInputVersionRef.current'));
});
