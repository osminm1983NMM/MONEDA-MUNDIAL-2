const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'RemittanceDemoScreen.js'), 'utf8');

test('avisa que la referencia de reintento se pierde al reiniciar', () => {
  assert.match(source, /La referencia de reintento no se conserva después de reiniciar/);
});

test('ofrece consulta de remesas antes de una nueva creación', () => {
  const warning = source.indexOf('Si la aplicación se cerró durante una creación');
  const lookup = source.indexOf("button('Consultar remesas ficticias recientes', loadRecent)");
  assert.ok(warning >= 0 && lookup > warning);
  assert.match(source, /async function loadRecent\(\)/);
});
