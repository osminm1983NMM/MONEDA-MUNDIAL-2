// Ejecutar: node --test tests/conversion-input.test.cjs
// Pruebas sin dependencias adicionales para la validación de montos de conversión.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const line = source.split('\n').find(line => line.includes('if (!/^(?:0|[1-9]'));
assert.ok(line, 'No se encontró la expresión de validación en App.js');
const pattern = new RegExp(line.slice(line.indexOf('if (!/') + 6, line.lastIndexOf('/.test')));

test('acepta enteros y hasta seis decimales', () => {
  for (const value of ['0', '1', '10', '1.5', '0.000001', '9999.999999']) {
    assert.equal(pattern.test(value), true, value);
  }
});

test('rechaza formatos ambiguos o no permitidos', () => {
  for (const value of ['', '-1', '1.0000001', '01', '1.', '.5', '1e3', '1,5', 'abc']) {
    assert.equal(pattern.test(value), false, value);
  }
});

test('el mensaje de error contiene salto de línea real', () => {
  assert.ok(source.includes(String.raw`'\nConsulta los saldos antes de intentar otra conversión.'`));
});
