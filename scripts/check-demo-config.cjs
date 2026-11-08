// Validación estática sin dependencias, red, builds ni cambios en la base de datos.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const checks = [
  ['Expo 54', () => assert.match(pkg.dependencies.expo, /^~54\./)],
  ['Identidad Android configurada', () => assert.equal(config.expo.android.package, 'com.monedamundial.app')],
  ['APK de distribución interna', () => {
    assert.equal(eas.build.preview.android.buildType, 'apk');
    assert.equal(eas.build.preview.distribution, 'internal');
  }],
  ['Funciones de conversión ficticia', () => {
    for (const rpc of ['mwd_conversion_wallet_demo', 'mwd_conversion_quote_demo', 'mwd_conversion_confirm_demo', 'mwd_conversion_reconcile_demo']) {
      assert.ok(app.includes(rpc), 'Falta llamada RPC: ' + rpc);
    }
  }],
  ['Validación explícita de modo ficticio', () => {
    assert.ok(app.includes("data?.realPaymentsEnabled !== false"));
    assert.ok(app.includes("data?.priceIsReal !== false"));
    assert.ok(app.includes("data?.provider !== 'synthetic_sandbox'"));
  }],
  ['Referencia pendiente guardada antes de confirmar', () => {
    const save = app.indexOf("await AsyncStorage.setItem('mwd_swap_pending_' + requestedUserId, quote.quoteId)");
    const confirm = app.indexOf("supabase.rpc('mwd_conversion_confirm_demo'");
    assert.ok(save !== -1 && confirm > save);
  }],
  ['Identificador de cotización UUID validado', () => {
    assert.ok(app.includes("typeof data?.quoteId !== 'string'"));
    assert.match(app, /test\(data\.quoteId\)/);
  }],
  ['Cuenta activa obligatoria en operaciones de conversión', () => {
    for (const name of ['loadSwapWallet', 'requestSwapQuote', 'confirmSwap', 'reconcileSwap']) {
      const start = app.indexOf('async function ' + name + '()');
      assert.ok(start !== -1, 'Falta ' + name);
      const bodyStart = app.indexOf('{', start);
      const guard = app.slice(bodyStart, bodyStart + 350);
      assert.ok(guard.includes('authUserRef.current !== userId'), 'Falta verificar cuenta en ' + name);
    }
  }],
];
let failed = 0;
for (const [label, check] of checks) {
  try { check(); console.log('OK:', label); }
  catch (error) { failed++; console.error('ERROR:', label, error.message); }
}
if (failed) process.exitCode = 1;
else console.log(checks.length + ' verificaciones estáticas aprobadas. No sustituye compilación ni pruebas Android.');
