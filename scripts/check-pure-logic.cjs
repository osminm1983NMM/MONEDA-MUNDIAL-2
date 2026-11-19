// Pruebas de lógica pura sin React Native ni llamadas a Supabase.
// Extrae funciones aisladas de App.js y las ejecuta en un contexto controlado.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const app = fs.readFileSync('App.js', 'utf8');
function extract(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, 'No se pudo extraer ' + start);
  return app.slice(from, to);
}
const sandbox = { Number, Uint8Array, Array, globalThis: { crypto: {
  getRandomValues(bytes) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 17 + 3) % 256;
    return bytes;
  },
} } };
vm.createContext(sandbox);
vm.runInContext(
  extract('function amountToCents(value)', 'function uniqueRequestId()') +
  extract('function uniqueRequestId()', 'function message(') +
  ';globalThis.amountToCents=amountToCents;globalThis.uniqueRequestId=uniqueRequestId;',
  sandbox
);
const amountToCents = sandbox.globalThis.amountToCents;
const uniqueRequestId = sandbox.globalThis.uniqueRequestId;
const valid = [['1',100],['0.01',1],['1,25',125],['1000000',100000000],['0002.50',250]];
for (const [input, expected] of valid) assert.equal(amountToCents(input), expected, input);
const invalid = ['', '0', '-1', '0.001', '1.234', '1000000.01', '1e3', 'NaN', '1,2,3', '1.2.3'];
for (const input of invalid) assert.equal(amountToCents(input), null, input);
const uuid = uniqueRequestId();
assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
console.log('PASS: 15 casos de cantidades y UUID v4 con formato válido');
