import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const expo = path.join(root, 'node_modules', '.bin', 'expo');

function resolvedExpoConfig(variant = '') {
  const output = execFileSync(expo, ['config', '--json'], {
    cwd: root,
    env: {...process.env, MWD_APP_VARIANT: variant},
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(output);
}

test('Expo realmente resuelve el paquete original sin activar LAB', () => {
  const config = resolvedExpoConfig();
  assert.equal(config.name, 'Moneda Mundial 2.0');
  assert.equal(config.android?.package, 'com.monedamundial.app');
  assert.equal(config.android?.versionCode, 2);
  assert.notEqual(config.extra?.mwdLabOnly, true);
});

test('Expo realmente resuelve la identidad Samsung LAB sin sobrescribir la principal', () => {
  const config = resolvedExpoConfig('samsung-lab');
  assert.equal(config.name, 'Moneda Mundial LAB DEMO');
  assert.equal(config.android?.package, 'com.monedamundial.app.samsunglab');
  assert.equal(config.android?.versionCode, 1);
  assert.equal(config.scheme, 'monedamundiallab');
  assert.equal(config.extra?.mwdLabOnly, true);
  assert.equal(resolvedExpoConfig().android?.package, 'com.monedamundial.app');
});

test('Expo bloquea una variante no autorizada', () => {
  assert.throws(() => resolvedExpoConfig('produccion'), /Command failed|Error/);
});
