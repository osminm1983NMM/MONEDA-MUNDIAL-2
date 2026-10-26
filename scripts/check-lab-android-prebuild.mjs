// Contrato de solo lectura para el proyecto nativo temporal de Samsung LAB.
// Se ejecuta después de Expo prebuild; no compila ni firma APK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (name) => readFileSync(new URL(name, new URL('../', import.meta.url)), 'utf8');
const base = JSON.parse(read('app.json')).expo;
const build = read('android/app/build.gradle');

assert.equal(process.env.MWD_APP_VARIANT, 'samsung-lab', 'La verificación debe ejecutarse en modo LAB');
assert.equal(base.android.package, 'com.monedamundial.app', 'La identidad principal no debe cambiar');
assert.equal(base.android.versionCode, 2, 'La versión principal no debe cambiar');

const appId = build.match(/\bapplicationId\s*(?:=\s*)?['"]([^'"]+)['"]/);
const version = build.match(/\bversionCode\s*(?:=\s*)?(\d+)\b/);
assert.ok(appId, 'Gradle debe declarar applicationId');
assert.ok(version, 'Gradle debe declarar versionCode');
assert.equal(appId[1], 'com.monedamundial.app.samsunglab');
assert.equal(Number(version[1]), 1);
assert.notEqual(appId[1], base.android.package);

console.log('OK: Android nativo temporal identifica LAB como paquete independiente; app.json original intacto.');
