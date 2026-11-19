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

test('Expo EAS project ID is configured before APK release', () => {
  assert.match(expo.extra.eas.projectId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(expo.owner, '12051983');
});

test('preview profile is separate from production and uses Node 22', () => {
  assert.equal(eas.build.preview.node, '22.14.0');
  assert.equal(eas.build.production, undefined);
});
