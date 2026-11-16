const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'RemittanceDemoScreen.js'), 'utf8');

test('avisa que la referencia local válida se recupera al reiniciar', () => {
  assert.match(source, /Si existe una referencia local válida, se recuperará al reiniciar/);
});

test('ofrece consulta de remesas antes de una nueva creación', () => {
  const warning = source.indexOf('Si la aplicación se cerró durante una creación');
  const lookup = source.indexOf("button('Consultar remesas ficticias recientes', loadRecent)");
  assert.ok(warning >= 0 && lookup > warning);
  assert.match(source, /async function loadRecent\(\)/);
});
