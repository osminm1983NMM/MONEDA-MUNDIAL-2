'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('new demo accounts require stronger passwords while old accounts can still sign in', () => {
  const handler = app.slice(app.indexOf('async function authenticate(action)'), app.indexOf('async function requestPasswordReset()'));
  assert.match(handler, /password\.length < \(action === 'register' \? 12 : 8\)/);
  assert.match(handler, /supabase\.auth\.signUp\(/);
  assert.match(handler, /supabase\.auth\.signInWithPassword\(/);
});

test('password changes also require at least 12 characters', () => {
  const handler = app.slice(app.indexOf('async function changeSignedInPassword()'), app.indexOf('function changeAmount('));
  assert.match(handler, /newPassword\.length < 12/);
});
