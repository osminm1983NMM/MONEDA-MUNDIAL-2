// Pruebas de fallos de red simulados. No llama a Supabase ni ejecuta la app Android.
const assert = require('node:assert/strict');
async function saveWithRefresh(rpc, refresh) {
  try { await rpc(); }
  catch (e) { return { state: 'unknown', retrySafe: false }; }
  try { await refresh(); return { state: 'confirmed-and-refreshed', retrySafe: false }; }
  catch (e) { return { state: 'confirmed-refresh-failed', retrySafe: false }; }
}
(async () => {
  let writes = 0, refreshes = 0;
  const before = await saveWithRefresh(async () => { throw Error('offline'); }, async () => { refreshes++; });
  assert.equal(before.state, 'unknown'); assert.equal(refreshes, 0);
  const after = await saveWithRefresh(async () => { writes++; throw Error('response lost'); }, async () => { refreshes++; });
  assert.equal(after.state, 'unknown'); assert.equal(writes, 1); assert.equal(refreshes, 0);
  const read = await saveWithRefresh(async () => { writes++; }, async () => { refreshes++; throw Error('offline refresh'); });
  assert.equal(read.state, 'confirmed-refresh-failed'); assert.equal(writes, 2); assert.equal(refreshes, 1);
  const ok = await saveWithRefresh(async () => { writes++; }, async () => { refreshes++; });
  assert.equal(ok.state, 'confirmed-and-refreshed'); assert.equal(writes, 3); assert.equal(refreshes, 2);
  for (const result of [before, after, read, ok]) assert.equal(result.retrySafe, false);
  console.log('4 escenarios de fallo/éxito simulados completados.');
})().catch(e => { console.error(e); process.exitCode = 1; });
