// Prueba el mismo módulo que importa PartnerRegistryScreen, sin Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'partnerWriteFlow.js'), 'utf8');
  const { writeThenRefresh } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  let reads = 0;
  let writes = 0;
  const before = await writeThenRefresh(async () => { throw Error('sin red'); }, async () => { reads++; });
  assert.equal(before.state, 'unknown');
  assert.equal(reads, 0);
  const after = await writeThenRefresh(async () => { writes++; throw Error('respuesta perdida'); }, async () => { reads++; });
  assert.equal(after.state, 'unknown');
  assert.equal(writes, 1);
  assert.equal(reads, 0);
  const refreshFailed = await writeThenRefresh(async () => { writes++; return { id: 'socio-1' }; }, async () => { reads++; throw Error('lectura sin red'); });
  assert.equal(refreshFailed.state, 'confirmed-refresh-failed');
  assert.equal(refreshFailed.result.id, 'socio-1');
  const ok = await writeThenRefresh(async () => { writes++; return { id: 'socio-2' }; }, async result => { reads++; assert.equal(result.id, 'socio-2'); });
  assert.equal(ok.state, 'confirmed');
  assert.equal(writes, 3);
  assert.equal(reads, 2);
  console.log('4 pruebas del módulo real de flujo de escritura completadas.');
})().catch(error => { console.error(error); process.exitCode = 1; });
