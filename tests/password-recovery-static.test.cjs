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
  assert.match(handler, /supabase\.auth\.resetPasswordForEmail\(cleanEmail, \{/);
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

test('Android recovery links are handled with tokens and not logged', () => {
  assert.match(app, /Linking\.getInitialURL\(\)/);
  assert.match(app, /Linking\.addEventListener\('url'/);
  assert.match(app, /params\.get\('type'\) !== 'recovery'/);
  assert.match(app, /supabase\.auth\.setSession\(\{/);
  assert.match(app, /redirectTo: 'monedamundial:\/\/auth\/recovery'/);
  assert.doesNotMatch(app, /console\.log\(accessToken\)/);
});

test('recovery callback only accepts the exact app path', () => {
  assert.match(app, /callbackPath !== 'monedamundial:\/\/auth\/recovery'/);
  assert.match(app, /url\.split\(\/\[\?#\]\/\)\[0\]/);
});

test('recovery callback supports PKCE code and rejects error callbacks', () => {
  assert.match(app, /params\.get\('code'\)/);
  assert.match(app, /supabase\.auth\.exchangeCodeForSession\(authCode\)/);
  assert.match(app, /params\.get\('error'\)/);
  assert.match(app, /supabase\.auth\.setSession\(\{/);
});

test('recovery callback combines query and fragment parameters', () => {
  assert.match(app, /new URLSearchParams\(query\)/);
  assert.match(app, /new URLSearchParams\(fragment\)/);
  assert.match(app, /fragmentParams\.entries\(\)/);
  assert.match(app, /params\.set\(key, value\)/);
});

test('sign-in auth events preserve the account password-change screen', () => {
  assert.match(app, /setScreen\(previous => previous === 'Cuenta' \? previous : 'Inicio'\)/);
});

test('recovery deep links cannot be exchanged concurrently twice', () => {
  assert.match(app, /const processingRecoveryUrls = new Set\(\)/);
  assert.match(app, /processingRecoveryUrls\.has\(url\)/);
  assert.match(app, /processingRecoveryUrls\.add\(url\)/);
  assert.match(app, /finally\s*\{\s*processingRecoveryUrls\.delete\(url\)/);
});

test('Supabase uses PKCE so Android code exchange has a stored verifier', () => {
  assert.match(app, /flowType: 'pkce'/);
  assert.match(app, /storage: AsyncStorage/);
  assert.match(app, /detectSessionInUrl: false/);
});

test('recovery rejects ambiguous callbacks with both PKCE code and session tokens', () => {
  assert.match(app, /authCode && \(accessToken \|\| refreshToken\)/);
  assert.match(app, /params\.get\('type'\) !== 'recovery' && !authCode/);
});

test('successfully consumed recovery links cannot be exchanged twice in one app session', () => {
  assert.match(app, /const completedRecoveryUrls = new Set\(\)/);
  assert.match(app, /processingRecoveryUrls\.has\(url\) \|\| completedRecoveryUrls\.has\(url\)/);
  assert.match(app, /completedRecoveryUrls\.add\(url\)/);
});

test('expired recovery links show a generic message before checking callback type', () => {
  const errorBranch = app.indexOf("if (params.get('error'))");
  const typeBranch = app.indexOf("if (params.get('type') !== 'recovery' && !authCode)");
  assert.ok(errorBranch > 0 && typeBranch > errorBranch);
  assert.match(app.slice(errorBranch, typeBranch), /El enlace venció o no es válido/);
});
