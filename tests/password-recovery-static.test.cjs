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

test('password reset email validation accepts ordinary addresses', () => {
  const handler = app.slice(app.indexOf('async function requestPasswordReset()'), app.indexOf('async function changeSignedInPassword()'));
  const regexSource = handler.match(/if \(!\/(.+)\/\.test\(cleanEmail\)\)/);
  assert.ok(regexSource, 'reset email validation must use a regex');
  const emailPattern = new RegExp(regexSource[1]);
  assert.equal(emailPattern.test('persona@example.com'), true);
  assert.equal(emailPattern.test('persona+demo@example.org'), true);
  assert.equal(emailPattern.test('correo-invalido'), false);
});
