'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const expo = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));

test('Android app declares an explicit auth callback scheme', () => {
  assert.equal(expo.scheme, 'monedamundial');
  assert.equal(expo.android.package, 'com.monedamundial.app');
});

test('preview Android build is an installable APK, not an app bundle', () => {
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.preview.distribution, 'internal');
});
