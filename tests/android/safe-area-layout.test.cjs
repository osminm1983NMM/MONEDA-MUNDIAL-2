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
