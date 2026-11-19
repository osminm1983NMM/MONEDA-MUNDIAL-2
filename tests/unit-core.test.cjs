// Pruebas unitarias ejecutables sin Supabase ni dinero real.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

// Ejecuta únicamente las dos funciones puras, extraídas del mismo App.js de producción.
const start = source.indexOf('function amountToCents(value)');
const end = source.indexOf('function message(title, body)', start);
assert.ok(start >= 0 && end > start, 'No se encontraron funciones puras');
const limitDeclaration = source.match(/const LIMIT_CENTS = \d+;/);
assert.ok(limitDeclaration, 'No se encontró el límite de importes de la aplicación');
const pure = limitDeclaration[0] + '\n' + source.slice(start, end);
const sandbox = { globalThis: { crypto: { getRandomValues: arr => crypto.randomFillSync(arr) } }, Uint8Array };
vm.createContext(sandbox);
vm.runInContext(pure + '\nthis.amountToCents = amountToCents; this.uniqueRequestId = uniqueRequestId;', sandbox, { timeout: 1000 });

test('cantidades válidas en centavos sin redondeos imprevistos', () => {
  const cases = [['0.01', 1], ['1', 100], ['1.2', 120], ['1,25', 125],
    ['1000000', 100000000], [' 9.99 ', 999], ['0002.03', 203]];
  for (const [input, expected] of cases) assert.equal(sandbox.amountToCents(input), expected, input);
});
test('rechaza cantidades inválidas, negativas, cero, excesivas o con más de dos decimales', () => {
  for (const input of ['0', '0.00', '-1', '1000000.01', '1.001', '1e3',
    'NaN', 'Infinity', '1,234.56', '', ' ', '.5', '1.', 'abc', '999999999999999999999']) {
    assert.equal(sandbox.amountToCents(input), null, input);
  }
});
test('UUID v4 aleatorios con bits de versión y variante correctos', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    const id = sandbox.uniqueRequestId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 1000, 'Identificadores repetidos en la muestra');
});
test('si falta generador criptográfico, no crea identificadores inseguros', () => {
  const original = sandbox.globalThis.crypto;
  sandbox.globalThis.crypto = null;
  try { assert.throws(() => sandbox.uniqueRequestId(), /generador de identificadores seguros/); }
  finally { sandbox.globalThis.crypto = original; }
});
