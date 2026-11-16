'use strict';
// Verificación sin red de la conversión de importes de la billetera ficticia.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('App.js', 'utf8');
const start = source.indexOf('const LIMIT_CENTS =');
const end = source.indexOf('function uniqueRequestId()', start);
assert.ok(start >= 0 && end > start, 'Conversor de importes no encontrado');
const amountToCents = vm.runInNewContext(source.slice(start, end) + '\namountToCents');

test('billetera: importes validos se convierten a centavos', () => {
  for (const [value, cents] of [['0.01', 1], ['1', 100], ['1,25', 125], ['2.50', 250], ['1000000', 100000000]]) {
    assert.equal(amountToCents(value), cents, value);
  }
});

test('billetera: rechaza montos invalidos y fuera de limite', () => {
  for (const value of ['0', '-1', '1.234', '1e3', '1000000.01', 'abc', '', '.5', '1,000.00']) {
    assert.equal(amountToCents(value), null, value);
  }
});
