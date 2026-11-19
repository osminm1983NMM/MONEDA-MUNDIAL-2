'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('initial session lookup cannot overwrite a newer auth event', () => {
  const start = app.indexOf('supabase.auth.getSession()');
  const end = app.indexOf('subscription.unsubscribe()', start);
  assert.ok(start > 0 && end > start);
  const auth = app.slice(start, end);
  assert.match(auth, /if \(active && !receivedAuthEvent\) setSession\(data\.session\)/);
  assert.match(auth, /receivedAuthEvent = true;\s*setSession\(nextSession\)/);
});

test('late auth initialization errors are not shown after a newer auth event', () => {
  assert.match(app, /if \(active && !receivedAuthEvent\) message\('Sesión', error\.message\)/);
});
