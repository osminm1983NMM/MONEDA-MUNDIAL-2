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
  assert.match(workflow, /npm run test:demo/);
  assert.match(workflow, /eas build --platform android --profile preview/);
});

test('aplicación conserva avisos de dinero ficticio y usa clave publicable', () => {
  const app = read('App.js');
  assert.match(app, /NO mueve dinero real/);
  assert.match(app, /sb_publishable_/);
  assert.doesNotMatch(app, /['\"]sb_secret_[^'\"]+['\"]/);
});


test('pantalla de remesas existe y está conectada a App.js', () => {
  const app = read('App.js');
  const screen = read('RemittanceDemoScreen.js');
  assert.ok(app.includes("import RemittanceDemoScreen from './RemittanceDemoScreen';"));
  assert.ok(app.includes('<RemittanceDemoScreen supabase={supabase} adminRole={adminRole} />'));
  assert.match(screen, /Sin dinero real/);
});

test('workflow del APK usa rama integrada y conjunto completo de pruebas', () => {
  const workflow = read('.github/workflows/build-remesas-demo-apk-manual.yml');
  const pkg = JSON.parse(read('package.json'));
  assert.match(workflow, /ref: pruebas-concurrencia-remesas/);
  assert.match(workflow, /npm run test:demo/);
  for (const file of ['android-config-safety.test.cjs', 'remesas-concurrencia.test.js',
    'remittance-amounts.test.cjs', 'remittance-build-safety.test.cjs']) {
    assert.ok(pkg.scripts['test:demo'].includes(file), file + ' no incluido en test:demo');
    assert.ok(read('tests/' + file).length > 0, file + ' vacío');
  }
});
