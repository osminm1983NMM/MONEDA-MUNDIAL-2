import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const main = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));

function variantConfig(variant) {
  const previous = process.env.MWD_APP_VARIANT;
  try {
    if (variant == null) delete process.env.MWD_APP_VARIANT;
    else process.env.MWD_APP_VARIANT = variant;
    return configure({config: structuredClone(main)});
  } finally {
    if (previous == null) delete process.env.MWD_APP_VARIANT;
    else process.env.MWD_APP_VARIANT = previous;
  }
}

test('Expo EAS corresponde al proyecto existente de la cuenta 12051983', () => {
  assert.equal(main.slug, 'moneda-mundial-20');
  assert.equal(main.owner, '12051983');
  assert.equal(main.extra?.eas?.projectId, '93c31760-4d1e-49f3-888b-9b5845c31e53');
  const lab = variantConfig('samsung-lab');
  assert.equal(lab.extra?.eas?.projectId, main.extra.eas.projectId);
  assert.equal(lab.owner, main.owner);
  assert.equal(lab.slug, main.slug);
});

test('configuración normal conserva la identidad de la APK existente', () => {
  assert.deepEqual(variantConfig(null), main);
  assert.equal(main.android.package, 'com.monedamundial.app');
  assert.equal(main.android.versionCode, 2);
});

test('LAB se instala en paralelo y no comparte identidad ni enlaces de la app principal', () => {
  const lab = variantConfig('samsung-lab');
  assert.equal(lab.name, 'Moneda Mundial LAB DEMO');
  assert.equal(lab.android.package, 'com.monedamundial.app.samsunglab');
  assert.equal(lab.android.versionCode, 2);
  assert.notEqual(lab.android.package, main.android.package);
  assert.notEqual(lab.scheme, main.scheme);
  assert.equal(lab.extra.mwdLabOnly, true);
  assert.deepEqual(main, variantConfig(null));
});

test('variante desconocida o paquete principal inesperado bloquean la compilación', () => {
  assert.throws(() => variantConfig('production'), /desconocida/);
  const previous = process.env.MWD_APP_VARIANT;
  try {
    process.env.MWD_APP_VARIANT = 'samsung-lab';
    assert.throws(() => configure({config: {...main, android: {package:'com.ajeno.app'}}}),
      /principal cambió/);
  } finally {
    if (previous == null) delete process.env.MWD_APP_VARIANT;
    else process.env.MWD_APP_VARIANT = previous;
  }
});

test('perfil EAS LAB es interno y solo prepara APK, sin publicación automática', () => {
  const lab = eas.build['samsung-lab'];
  assert.equal(lab.distribution, 'internal');
  assert.equal(lab.android.buildType, 'apk');
  assert.equal(lab.android.image, 'latest');
  assert.deepEqual(lab.env, {MWD_APP_VARIANT:'samsung-lab'});
  assert.equal(eas.build.preview.env?.MWD_APP_VARIANT, undefined);
});
