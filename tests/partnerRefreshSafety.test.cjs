// Comprobaciones estructurales: no sustituyen pruebas React Native ni Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const screen = fs.readFileSync(path.join(__dirname, '..', 'PartnerRegistryScreen.js'), 'utf8');
const start = screen.indexOf('  async function reloadPartners()');
const end = screen.indexOf('  async function reloadDetails(', start);
assert.ok(start >= 0 && end > start, 'Existe función de recarga');
const reload = screen.slice(start, end);
const invalidate = reload.indexOf('setDetailsReady(false)');
const request = reload.indexOf("request('mwd_owner_partners_demo')");
assert.ok(invalidate >= 0 && invalidate < request, 'Invalida detalles antes de la consulta');
assert.ok(reload.indexOf('setListReady(false)') < request, 'Invalida listado antes de la consulta');
const selected = screen.indexOf('  async function setStatus(');
const selectedEnd = screen.indexOf('  async function saveLocation(', selected);
assert.ok(screen.slice(selected, selectedEnd).includes('!detailsReady'), 'Estado exige detalles actualizados');
assert.ok(screen.includes('disabled={busy || !detailsReady}'), 'Botón de estado se bloquea sin detalles');
console.log('4 comprobaciones estructurales de recuperación superadas.');
