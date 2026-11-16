// Static guards for Android-only fictional remittance recovery.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
const app = fs.readFileSync('App.js', 'utf8');
const section = (start, end) => {
 const a = screen.indexOf(start), b = screen.indexOf(end, a);
 assert.ok(a >= 0 && b > a);
 return screen.slice(a,b);
};
test('pending requests restore from per-user AsyncStorage before actions', () => {
 assert.match(screen,/readPending\(AsyncStorage, userId\)/);
 assert.match(screen,/setRestoring\(false\)/);
 assert.match(screen,/restoring \|\| storageError/);
 assert.match(app,/<RemittanceDemoScreen key=\{userId\} userId=\{userId\}/);
});
test('creation writes durable request before network RPC', () => {
 const s = section('async function create(cents)', 'async function transition(next)');
 assert.ok(s.indexOf('await savePending(AsyncStorage, userId') >= 0);
 assert.ok(s.indexOf('await savePending(AsyncStorage, userId') < s.indexOf("supabase.rpc('mwd_owner_remittance_create_demo'"));
 assert.match(s,/createdAt: pendingCreate\.current\.createdAt/);
});
test('transition writes durable request before network RPC', () => {
 const s = section('async function transition(next)', 'async function loadRecent()');
 assert.ok(s.indexOf('await savePending(AsyncStorage, userId') >= 0);
 assert.ok(s.indexOf('await savePending(AsyncStorage, userId') < s.indexOf("supabase.rpc('mwd_owner_remittance_transition_demo'"));
 assert.match(s,/createdAt: pendingTransition\.current\.createdAt/);
});
test('read-only refresh cannot erase original idempotency key', () => {
 const s = section('async function refreshSelected()', 'async function selectRecent(item)');
 assert.doesNotMatch(s,/clearPending\(/);
 assert.doesNotMatch(s,/pendingTransition\.current = null/);
});

test('pending transition hides all competing state change buttons',()=>{
 assert.match(screen,/!pendingTransition\.current && order\.status === 'draft' && button\('Enviar a revisión'/);
 assert.match(screen,/!pendingTransition\.current && order\.status === 'review' && button\('Completar simulación'/);
 assert.match(screen,/!pendingTransition\.current && \['draft', 'review'\]\.includes\(order\.status\) && button\('Cancelar simulación'/);
 assert.match(screen,/button\('Reintentar cambio pendiente'/);
});
