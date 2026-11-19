'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('Supabase password recovery event guides user to account password form', () => {
  assert.match(app, /event === 'PASSWORD_RECOVERY'/);
  assert.match(app, /setRecoveryMode\(true\)/);
  assert.match(app, /setScreen\('Cuenta'\)/);
  assert.match(app, /recoveryMode && <Text/);
});

test('password recovery mode ends after successful change or sign out', () => {
  const change = app.slice(app.indexOf('async function changeSignedInPassword()'), app.indexOf('function changeAmount('));
  assert.match(change, /setRecoveryMode\(false\)/);
  assert.match(app, /event === 'SIGNED_OUT'[\s\S]*?setRecoveryMode\(false\)/);
});
