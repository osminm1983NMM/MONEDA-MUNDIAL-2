'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('signed-in password change validates session and uses Supabase Auth', () => {
  const start = app.indexOf('async function changeSignedInPassword()');
  const end = app.indexOf('function changeAmount(', start);
  assert.ok(start >= 0 && end > start);
  const handler = app.slice(start, end);
  assert.match(handler, /newPassword\.length < 12/);
  assert.match(handler, /supabase\.auth\.getUser\(\)/);
  assert.match(handler, /data\.user\?\.id !== requestedUserId/);
  assert.match(handler, /supabase\.auth\.updateUser\(\{ password: newPassword \}\)/);
  assert.match(handler, /setNewPassword\(''\)/);
  assert.match(handler, /finally/);
});

test('account screen masks password and prevents duplicate submission', () => {
  assert.match(app, /secureTextEntry autoCapitalize="none"/);
  assert.match(app, /onPress=\{changeSignedInPassword\} disabled=\{passwordChangeBusy\}/);
  assert.match(app, /setNewPassword\(''\);\s*setPasswordChangeBusy\(false\);\s*\}, \[userId\]\)/);
});
