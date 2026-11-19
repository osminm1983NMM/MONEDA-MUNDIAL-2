// Comprobaciones estáticas de regresión. No sustituyen pruebas RPC/RLS ni Android.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
const checks = [
  ['modo demostración', /SOLO DEMOSTRACIÓN • SIN DINERO REAL/],
  ['clave publicable', /SUPABASE_PUBLISHABLE_KEY/],
  ['sin service_role embebida', /^(?!.*(?:const|let|var)\s+\w*(?:SERVICE_ROLE|SECRET_KEY)\w*\s*=).*$/s],
  ['historial filtrado por origen y destino', /\.or\(`source_user_id\.eq\.\$\{id\},destination_user_id\.eq\.\$\{id\}`\)/],
  ['refresco invalidable', /refreshSequenceRef\.current === sequence/],
  ['limpieza de datos al cambiar sesión', /setWallet\(null\);\s*setOperations\(\[\]\);\s*setAdminRole\(null\);/],
  ['transferencia con idempotencia', /mwd_transfer_demo[\s\S]{0,150}p_request_id: requestId/],
  ['retiro con idempotencia', /mwd_pickup_create_demo[\s\S]{0,170}p_request_id: requestId/],
  ['reintento retiro conserva identificador', /pickupPendingRef\.current\.id/],
  ['renovación de token no reinicia navegación', /if \(event === 'SIGNED_IN' \|\| event === 'SIGNED_OUT' \|\| event === 'USER_DELETED'\)/],
];
let failures = 0;
for (const [name, regex] of checks) {
  const ok = regex.test(app);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failures++;
}
assert.equal(failures, 0, `${failures} comprobaciones fallaron`);
