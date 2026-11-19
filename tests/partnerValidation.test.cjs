// Ejecutar con: node tests/partnerValidation.test.cjs
// Usa solo herramientas integradas de Node.js; no necesita Supabase ni Expo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'partnerValidation.js'), 'utf8');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const { validPartner, validLocation } = mod;
  assert.equal(validPartner('Banco Demo', 'HN'), true);
  assert.equal(validPartner(' Banco Demo ', 'hn'), true);
  assert.equal(validPartner('A', 'HN'), false);
  assert.equal(validPartner('A'.repeat(151), 'HN'), false);
  assert.equal(validPartner('Banco', 'H1'), false);
  assert.equal(validPartner('Banco', 'HND'), false);
  assert.equal(validPartner('', 'HN'), false);
  assert.equal(validLocation('Sucursal Centro', 'Tegucigalpa', 'HNL', ''), true);
  assert.equal(validLocation('Sucursal', 'San Pedro Sula', 'usd', 'L-V'), true);
  assert.equal(validLocation('S', 'Tegucigalpa', 'HNL', ''), false);
  assert.equal(validLocation('Sucursal', 'T', 'HNL', ''), false);
  assert.equal(validLocation('Sucursal', 'Tegucigalpa', 'HN', ''), false);
  assert.equal(validLocation('Sucursal', 'Tegucigalpa', 'HNL', 'x'.repeat(141)), false);
  assert.equal(validLocation('S'.repeat(141), 'Tegucigalpa', 'HNL', ''), false);
  console.log('14 pruebas de validación completadas.');
})().catch(error => { console.error(error); process.exitCode = 1; });
