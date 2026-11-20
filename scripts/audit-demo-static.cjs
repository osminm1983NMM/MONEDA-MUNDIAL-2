// Validación local, sin red ni acceso a Supabase. No modifica datos.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const files = ['package.json', 'app.json', 'App.js'];
for (const file of files) assert.ok(fs.existsSync(file), 'Falta ' + file);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const app = fs.readFileSync('App.js', 'utf8');
assert.ok(pkg.dependencies?.expo, 'Falta Expo');
assert.ok(pkg.dependencies?.['@supabase/supabase-js'], 'Falta cliente Supabase');
assert.ok(config.expo?.android?.package, 'Falta identificador Android');
assert.ok(config.expo?.extra?.eas?.projectId, 'Falta EAS projectId');
assert.match(app, /créditos ficticios|creditos ficticios/i, 'Falta aviso de créditos ficticios');
assert.match(app, /NO mueve dinero real/i, 'Falta aviso de que no mueve dinero real');
const prohibited = [
  /sb_secret_[A-Za-z0-9_-]+/g,
  /(?:service_role|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"][^'"]+['"]/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];
for (const [index, pattern] of prohibited.entries()) {
  assert.ok(!pattern.test(app), 'Posible secreto incrustado en App.js (regla ' + (index + 1) + ')');
}
console.log('PASS: estructura, configuración Android, advertencia DEMO y comprobación básica de secretos.');
console.log('NOTA: no valida RLS, RPC, transferencias, contabilidad, conexión ni instalación APK.');
