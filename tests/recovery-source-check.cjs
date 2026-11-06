const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
function check(name, condition) {
  assert.ok(condition, name);
  console.log('OK:', name);
}
const operation = app.split('async function executeOperation(')[1]?.split('function prepareOperation(')[0];
assert.ok(operation, 'executeOperation exists');
check('pending identifier is saved before network RPC',
  operation.indexOf("AsyncStorage.setItem('mwd-demo-pending-' + userId") >= 0 &&
  operation.indexOf("AsyncStorage.setItem('mwd-demo-pending-' + userId") < operation.indexOf("supabase.rpc('mwd_transfer_demo'"));
check('storage failure aborts network request',
  /catch \(storageError\)[\s\S]*?return message\('No se envió la operación'/.test(operation));
check('pending payload mismatch blocks new request',
  operation.includes('if (pending && (pending.type !== type || pending.cents !== cents || pending.code !== code))'));
check('confirmed result is checked before clearing local recovery record',
  operation.indexOf("includes(response.data?.status)") < operation.indexOf("AsyncStorage.removeItem('mwd-demo-pending-' + userId"));
check('failed local cleanup is reported separately', operation.includes('catch (cleanupError)'));
check('user-scoped recovery', app.includes("AsyncStorage.getItem('mwd-demo-pending-' + userId)"));
check('unreadable recovery blocks new operations', app.includes('setPendingReady(!recoveryFailed)'));
check('pending amount changes are blocked', /function changeAmount\(value\) \{\s*if \(pendingRef.current\)/.test(app));
check('pending recipient changes are blocked', /function changeRecipient\(value\) \{\s*if \(pendingRef.current\)/.test(app));
check('pending navigation permits read-only account and history without clearing recovery',
  /function navigate\(to\) \{[\s\S]*?if \(pendingRef.current\) \{[\s\S]*?\['Inicio', 'Historial', 'Cuenta', pendingScreen\]\.includes\(to\)/.test(app) &&
  /if \(pendingRef.current\) \{[\s\S]*?setScreen\(to\);\s*return;\s*\}/.test(app));

check('contribution type matches recovery', app.includes("!['transfer', 'contribution'].includes(pending.type)") && app.includes("prepareOperation('contribution')"));
check('swap numeric regex is not double escaped', !app.includes('\\\\d*'));
check('logout is blocked while a pending operation is unresolved',
  /async function logout\(\) \{[\s\S]*?if \(pendingRef.current\)/.test(app));
check('transfer pending retry is explicitly labeled',
  app.includes('Verificar transferencia pendiente') && app.includes('TRANSFERENCIA PENDIENTE DE VERIFICACIÓN'));
check('contribution pending retry is explicitly labeled',
  app.includes('Verificar aportación pendiente') && app.includes('APORTACIÓN PENDIENTE DE VERIFICACIÓN'));
check('recovered request identifier must be a UUID v4',
  app.includes('pending.id) ||') && app.includes('pending.cents > LIMIT_CENTS'));
check('auth token refresh preserves the current pending screen',
  /onAuthStateChange\(\(event, nextSession\) => \{[\s\S]*?if \(event === 'SIGNED_OUT'\) setScreen\('Inicio'\)/.test(app));
check('RPC response is scoped to the original authenticated user',
  app.includes('const operationUserId = userId;') &&
  app.includes('currentSession.data.session?.user?.id !== operationUserId') &&
  app.includes('Conserva el registro pendiente'));
check('expired quote has a distinct retry-safe message',
  app.includes("if (/cotizaci[oó]n vencida/i.test(detail))") &&
  app.includes("message('Cotización vencida', 'La cotización expiró y no se realizó una conversión nueva.") &&
  app.includes('setSwapQuote(null);'));
check('uncertain swap error uses an actual newline escape, not a literal backslash-n',
  app.includes("detail + '\\nNo solicites otra cotización todavía.") &&
  !app.includes("detail + '\\\\nNo solicites otra cotización todavía."));
const expoConfig = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const easConfig = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
check('Android LAB uses an isolated package and visible LAB label',
  expoConfig.android.package === 'com.monedamundial.app.samsunglab' &&
  expoConfig.name === 'Moneda Mundial 2.0 LAB' &&
  expoConfig.extra.mwdLabOnly === true);
check('Expo preview generates an internal Android APK',
  easConfig.build.preview.distribution === 'internal' &&
  easConfig.build.preview.android.buildType === 'apk');
console.log('All source invariants passed. Functional tests remain necessary.');
