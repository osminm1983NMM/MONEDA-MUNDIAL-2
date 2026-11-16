const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('RemittanceDemoScreen.js','utf8');
const start = source.indexOf('async function refreshSelected()');
const end = source.indexOf('async function selectRecent(',start);
const refresh = source.slice(start,end);

test('permits read-only refresh while transition remains uncertain',()=>{
 assert.ok(start >= 0 && end > start);
 assert.doesNotMatch(refresh,/busyRef\.current\s*\|\|\s*pendingTransition\.current/);
 assert.match(refresh,/supabase\.rpc\('mwd_owner_remittances_demo'\)/);
 assert.doesNotMatch(refresh,/mwd_owner_remittance_transition_demo/);
});
test('clears pending transition only when server reports the requested status',()=>{
 assert.match(refresh,/current\.status === pendingTransition\.current\.next/);
 assert.match(refresh,/pendingTransition\.current = null/);
 assert.match(refresh,/Conserva la referencia original/);
});
