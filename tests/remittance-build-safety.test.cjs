const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('preview profile produces an internal Android APK', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(eas.build?.preview?.distribution, 'internal');
  assert.equal(eas.build?.preview?.android?.buildType, 'apk');
});

test('Expo project has expected Android identity', () => {
  const expo = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  assert.equal(expo.android?.package, 'com.monedamundial.app');
  assert.equal(expo.extra?.eas?.projectId, '93c31760-4d1e-49f3-888b-9b5845c31e53');
});

test('remittance screen is rendered only inside owner-only administration branch', () => {
  const app = fs.readFileSync('App.js', 'utf8');
  assert.match(app, /import RemittanceDemoScreen from ['"]\.\/RemittanceDemoScreen['"]/);
  const ownerGate = app.indexOf("adminRole === 'owner' ? (");
  const remittance = app.indexOf('<RemittanceDemoScreen supabase={supabase} adminRole={adminRole} />');
  const nextBranch = app.indexOf(') : adminRole ? (', ownerGate);
  assert.ok(ownerGate !== -1 && remittance > ownerGate && nextBranch > remittance,
    'Remittance UI must remain inside owner-only administration branch');
});

test('demo screen uses only fictional remittance RPCs', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  const rpcNames = [...screen.matchAll(/supabase\.rpc\(['"]([^'"]+)['"]/g)].map(match => match[1]);
  const allowed = new Set([
    'mwd_owner_remittance_create_demo',
    'mwd_owner_remittance_transition_demo',
    'mwd_owner_remittances_demo'
  ]);
  assert.ok(rpcNames.length >= 3, 'Expected creation, transition and server read calls');
  assert.deepEqual(new Set(rpcNames), allowed,
    'Only approved fictional remittance RPCs may be used');
  assert.match(screen, /Sin dinero real/);
});

test('unconfirmed creation cannot silently change amount and request ID', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /pendingCreate\.current && pendingCreate\.current\.cents !== cents/);
  assert.match(screen, /if \(!pendingCreate\.current\)\s*pendingCreate\.current = \{ cents, requestId: uuid\(\) \}/);
});

test('unconfirmed transition cannot switch to a conflicting action', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /pendingTransition\.current\.id !== order\.id \|\| pendingTransition\.current\.next !== next/);
  assert.match(screen, /if \(!pendingTransition\.current\)\s*pendingTransition\.current = \{ id: order\.id, next, requestId: uuid\(\) \}/);
});

test('cloud APK build is manual-only and checks Expo token', () => {
  const workflow = fs.readFileSync('.github/workflows/build-remesas-demo-apk-manual.yml', 'utf8');
  assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*(push|pull_request|schedule):/m);
  assert.match(workflow, /secrets\.EXPO_TOKEN/);
  assert.match(workflow, /eas build --platform android --profile preview --non-interactive --wait/);
  assert.match(workflow, /ref: feature\/remesas-demo-ui/);
});

test('recent demo orders are retrieved from protected server RPC', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /async function loadRecent\(\)/);
  assert.match(screen, /adminRole !== 'owner'/);
  assert.match(screen, /supabase\.rpc\('mwd_owner_remittances_demo'\)/);
  assert.match(screen, /pendingCreate\.current \|\| pendingTransition\.current/);
});

test('selected demo order status can be refreshed from server', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /async function refreshSelected\(\)/);
  assert.match(screen, /pendingTransition\.current \|\| pendingCreate\.current/);
  assert.match(screen, /data\.find\(item => item\?\.id === order\.id\)/);
  assert.match(screen, /Actualizar estado desde el servidor/);
});

test('confirmation checks latest selected order before applying a transition', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /const orderRef = useRef\(null\)/);
  assert.match(screen, /orderRef\.current = order/);
  assert.match(screen, /orderRef\.current\?\.id !== confirmedOrderId/);
  assert.match(screen, /orderRef\.current\?\.status !== confirmedStatus/);
  assert.match(screen, /Confirmación vencida/);
});

test('recent recovery list stays in Honduras demo corridor', () => {
  const screen = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
  assert.match(screen, /item\.destination_country === 'HN'/);
  assert.match(screen, /setRecentOrders\(valid\.slice\(0, 10\)\)/);
});
