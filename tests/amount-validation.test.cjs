// Pruebas ejecutables de la función real de App.js; no acceden a Supabase.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const start = source.indexOf('function amountToCents(value) {');
const end = source.indexOf('\n\nfunction uniqueRequestId()', start);
assert.ok(start >= 0 && end > start, 'No se encontró la función original de conversión');
const amountToCents = vm.runInNewContext(
  'const LIMIT_CENTS = 100000000;\n' + source.slice(start, end) + '\namountToCents;',
  Object.create(null),
);

test('cantidades válidas se convierten a centavos exactos', () => {
  for (const [value, expected] of [
    ['0.01', 1], ['1', 100], ['10,50', 1050], ['1000000', 100000000], ['0001.23', 123],
  ]) assert.equal(amountToCents(value), expected, value);
});

test('cantidades inválidas no se procesan', () => {
  for (const value of [
    '0', '0.00', '-1', '1.234', '1000000.01', '1e3', 'NaN', '1,2,3', '',
  ]) assert.equal(amountToCents(value), null, value);
});
