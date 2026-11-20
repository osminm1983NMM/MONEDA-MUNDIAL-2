#!/usr/bin/env node
// Moneda Mundial 2.0: comprobaciones locales sin red, sin credenciales y sin costos.
const fs = require('node:fs');
const path = require('node:path');
let errors = 0;
const check = (ok, message) => { console.log((ok ? 'PASS ' : 'FAIL ') + message); if (!ok) errors++; };
const root = path.resolve(__dirname, '..');
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const pkg = readJson('package.json');
const app = readJson('app.json').expo;
const eas = readJson('eas.json');
check(pkg.private === true, 'El paquete no se publica accidentalmente');
check(/^~54\./.test(pkg.dependencies?.expo || ''), 'Expo SDK 54 declarado (actualizar solo con pruebas)');
check(app.android?.package === 'com.monedamundial.app', 'Identificador Android esperado');
check(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(app.extra?.eas?.projectId || ''), 'EAS projectId presente');
check(!!eas.build && typeof eas.build === 'object', 'Perfiles EAS definidos');
const appSource = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
check(!/sk_live_[A-Za-z0-9]+|sb_secret_[A-Za-z0-9]+|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(appSource), 'Sin patrones evidentes de claves privadas en App.js');
check(!/\b(service_role|SUPABASE_SERVICE_ROLE_KEY)\b/i.test(appSource), 'Sin referencias a service_role en App.js');
check(!/\b(eval\s*\(|new Function\s*\()/.test(appSource), 'Sin ejecución dinámica evidente en App.js');
console.log('Comprobaciones: ' + (errors ? errors + ' fallidas' : 'sin fallos detectados') + '. Esta revisión NO valida backend, RLS, APK ni transferencias reales.');
process.exitCode = errors ? 1 : 0;
