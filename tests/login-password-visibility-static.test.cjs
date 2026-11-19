'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('App.js', 'utf8');

test('login password is masked by default and can be toggled', () => {
  assert.match(app, /const \[showPassword, setShowPassword\] = useState\(false\)/);
  assert.match(app, /secureTextEntry=\{!showPassword\} value=\{password\}/);
  assert.match(app, /showPassword \? 'Ocultar contraseña' : 'Mostrar contraseña'/);
  assert.match(app, /onPress=\{\(\) => setShowPassword\(value => !value\)\}/);
});
