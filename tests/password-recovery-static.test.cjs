'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('login offers password recovery without requiring old password', () => {
  const start = app.indexOf('async function requestPasswordReset()');
  const end = app.indexOf('function changeAmount(', start);
  assert.ok(start >= 0 && end > start, 'password recovery handler exists');
  const handler = app.slice(start, end);
  assert.match(handler, /supabase\.auth\.resetPasswordForEmail\(cleanEmail\)/);
  assert.match(handler, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.doesNotMatch(handler, /password\.length|signInWithPassword/);
  assert.match(handler, /if \(authBusy\) return/);
  assert.match(handler, /finally\s*\{\s*setAuthBusy\(false\)/);
  assert.match(app, /title="Olvidé mi contraseña" secondary onPress=\{requestPasswordReset\} disabled=\{authBusy\}/);
});

test('password recovery does not claim an email address exists', () => {
  const handler = app.slice(app.indexOf('async function requestPasswordReset()'), app.indexOf('function changeAmount('));
  assert.match(handler, /Si el correo corresponde a una cuenta/);
});
