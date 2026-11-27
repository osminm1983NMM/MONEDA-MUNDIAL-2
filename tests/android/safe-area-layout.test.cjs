const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('Android declares the Expo-compatible safe area dependency', () => {
  assert.equal(pkg.dependencies['react-native-safe-area-context'], '~5.6.0');
  assert.match(app, /import \{ SafeAreaProvider, SafeAreaView, initialWindowMetrics \} from 'react-native-safe-area-context'/);
});
test('all screens and scrolling content are enclosed by safe system edges', () => {
  const provider = app.indexOf('<SafeAreaProvider initialMetrics={initialWindowMetrics}');
  const safe = app.indexOf("<SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>");
  const scroll = app.indexOf('<ScrollView style={styles.scroll}');
  const end = app.indexOf('</ScrollView>', scroll);
  const safeEnd = app.indexOf('</SafeAreaView>', end);
  const providerEnd = app.indexOf('</SafeAreaProvider>', safeEnd);
  assert.ok(provider >= 0 && provider < safe && safe < scroll && scroll < end && end < safeEnd && safeEnd < providerEnd);
  assert.match(app, /scroll: \{ flex: 1 \}/);
  assert.match(app, /<StatusBar barStyle="light-content" \/>/);
});


test('scroll position is reset on account and screen transitions, not normal balance updates', () => {
  const declaration = app.match(/const scrollKey = ([^;]+);/);
  assert.ok(declaration);
  const key = new Function('userId', 'screen', 'return ' + declaration[1]);
  assert.notEqual(key('A','Inicio'), key(null,'Inicio'));
  assert.notEqual(key('A','Inicio'), key('B','Inicio'));
  assert.notEqual(key('A','Inicio'), key('A','Historial'));
  assert.notEqual(key('A','Inicio'), key('A','CambiarContraseña'));
  assert.equal(key(null,'Inicio'), key(null,'Historial'));
  assert.equal(key('A','Inicio'), key('A','Inicio'));
  assert.match(app, /<ScrollView style=\{styles\.scroll\} key=\{scrollKey\}/);
});

test('login password requirement remains readable independently of the input placeholder', () => {
  assert.match(app, /placeholder="Contraseña" accessibilityLabel="Contraseña"/);
  assert.match(app, /<Text style=\{styles\.muted\}>Mínimo 8 caracteres\.<\/Text>/);
  assert.doesNotMatch(app, /placeholder="Contraseña \(8 caracteres mínimo\)"/);
  assert.match(app, /placeholder="Correo electrónico" accessibilityLabel="Correo electrónico"/);
});
