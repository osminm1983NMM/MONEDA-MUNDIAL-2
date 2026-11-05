import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require = createRequire(import.meta.url);
const configure = require('../app.config.js');
const main = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));

function resolve(variant) {
  const old = process.env.MWD_APP_VARIANT;
  try {
    if (variant === null) delete process.env.MWD_APP_VARIANT;
    else process.env.MWD_APP_VARIANT = variant;
    return configure({config: structuredClone(main)});
  } finally {
    if (old === undefined) delete process.env.MWD_APP_VARIANT;
    else process.env.MWD_APP_VARIANT = old;
  }
}

test('la identidad de la app principal no se altera', () => {
  assert.equal(resolve(null).android.package, 'com.monedamundial.app');
  assert.deepEqual(resolve(null), main);
});

test('LAB usa paquete independiente y mantiene el proyecto Expo', () => {
  const lab = resolve('samsung-lab');
  assert.equal(lab.android.package, 'com.monedamundial.app.samsunglab');
  assert.notEqual(lab.android.package, main.android.package);
  assert.equal(lab.extra.eas.projectId, main.extra.eas.projectId);
  assert.equal(lab.extra.mwdLabOnly, true);
});

test('variante inesperada falla y LAB no publica automáticamente', () => {
  assert.throws(() => resolve('production'), /desconocida/);
  assert.equal(eas.build['samsung-lab'].distribution, 'internal');
  assert.equal(eas.build['samsung-lab'].android.buildType, 'apk');
});
