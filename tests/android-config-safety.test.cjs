'use strict';
// Verificación local sin red, sin Expo y sin tocar saldos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('configuración Android produce APK interno', () => {
  const app = JSON.parse(read('app.json')).expo;
  const eas = JSON.parse(read('eas.json'));
  assert.match(app.android.package, /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.preview.distribution, 'internal');
});

test('dependencias Expo y React Native declaradas', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies.expo);
  assert.ok(pkg.dependencies['react-native']);
  assert.ok(pkg.dependencies['@supabase/supabase-js']);
});

test('APK manual exige token y pruebas antes de compilar', () => {
  const workflow = read('.github/workflows/build-remesas-demo-apk-manual.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /EXPO_TOKEN/);
  assert.match(workflow, /node --test/);
  assert.match(workflow, /eas build --platform android --profile preview/);
});

test('aplicación conserva avisos de dinero ficticio y usa clave publicable', () => {
  const app = read('App.js');
  assert.match(app, /NO mueve dinero real/);
  assert.match(app, /sb_publishable_/);
  assert.doesNotMatch(app, /(?:sb_secret_|service_role)/);
});
