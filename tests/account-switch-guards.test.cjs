// Pruebas estáticas de regresión: no conectan a Supabase ni modifican saldos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync(require('node:path').join(__dirname, '..', 'App.js'), 'utf8');

function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, 'No se encontró sección: ' + start);
  return app.slice(from, to);
}

test('cambio de cuenta invalida las cinco familias de solicitudes', () => {
  const effect = section('  useEffect(() => {\n    accountRefreshRevisionRef.current', '  async function refreshAccount(');
  for (const name of ['operationRevisionRef', 'swapConfirmRevisionRef', 'swapBusyRevisionRef', 'pickupCreateRevisionRef', 'pickupCancelRevisionRef']) {
    assert.ok(effect.includes(name + '.current += 1;'), name);
  }
});

test('finalización de transferencias no libera bloqueo de otra cuenta', () => {
  const code = section('  async function executeOperation(', '  function prepareOperation(');
  assert.match(code, /if \(operationRevision === operationRevisionRef\.current\) \{\s*busyRef\.current = false;/);
  assert.match(code, /if \(operationRevision !== operationRevisionRef\.current\) return;\s*message\('Operación no confirmada'/);
});

test('los tres procesos de conversión comparten un control de bloqueo', () => {
  const code = section('  async function loadSwapWallet(', '  async function createDemoPickup(');
  assert.equal((code.match(/const busyRevision = \+\+swapBusyRevisionRef\.current;/g) || []).length, 3);
  assert.equal((code.match(/if \(busyRevision === swapBusyRevisionRef\.current\) setSwapBusy\(false\);/g) || []).length, 3);
});

test('retiros antiguos no liberan bloqueos ni muestran errores tardíos', () => {
  const create = section('  async function createDemoPickup(', '  async function loadPickupOrders(');
  const cancel = section('  async function cancelDemoPickup(', '  function navigate(');
  assert.match(create, /if \(createRevision === pickupCreateRevisionRef\.current\) setPickupBusy\(false\);/);
  assert.match(cancel, /if \(cancelRevision === pickupCancelRevisionRef\.current\) setPickupCancelBusy\(false\);/);
  assert.match(create, /if \(createRevision !== pickupCreateRevisionRef\.current\) return;\s*message\('Resultado de orden no confirmado'/);
  assert.match(cancel, /if \(cancelRevision !== pickupCancelRevisionRef\.current\) return;\s*message\('Resultado de cancelación no confirmado'/);
});

test('consulta y cotización comprueban error explícito de sesión', () => {
  const wallet = section('  async function loadSwapWallet(', '  async function requestSwapQuote(');
  const quote = section('  async function requestSwapQuote(', '  async function confirmSwap(');
  for (const code of [wallet, quote]) {
    assert.match(code, /const authResult = await supabase\.auth\.getSession\(\);\s*if \(authResult\.error\) throw authResult\.error;/);
  }
});

test('cambio de cuenta libera indicadores de actualización y lista de retiros', () => {
  const effect = section('  useEffect(() => {\n    accountRefreshRevisionRef.current', '  async function refreshAccount(');
  assert.match(effect, /pickupOrdersRevisionRef\.current \+= 1;/);
  assert.match(effect, /accountRefreshRevisionRef\.current \+= 1;/);
  assert.match(effect, /setPickupOrdersBusy\(false\);/);
  assert.match(effect, /setSyncing\(false\);/);
});

test('lista de retiros comprueba errores de sesión antes de mostrar órdenes', () => {
  const code = section('  async function loadPickupOrders(', '  async function cancelDemoPickup(');
  assert.match(code, /const authResult = await supabase\.auth\.getSession\(\);\s*if \(authResult\.error\) throw authResult\.error;/);
  assert.match(code, /authResult\.data\.session\?\.user\?\.id !== requestedBy \|\| revision !== pickupOrdersRevisionRef\.current/);
});
