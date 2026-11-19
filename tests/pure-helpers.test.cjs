// Executable pure-function tests; loads exact helpers from App.js without React Native.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = fs.readFileSync('App.js', 'utf8');
const start = source.indexOf('const LIMIT_CENTS =');
const end = source.indexOf('\nfunction message(', start);
assert.ok(start >= 0 && end > start, 'pure helper functions are present');
const context = vm.createContext({ crypto: webcrypto, Uint8Array, Number, Array, Error });
vm.runInContext(source.slice(start, end) +
  '\nthis.helpers = { amountToCents, uniqueRequestId, formatMWD };', context);
const { amountToCents, uniqueRequestId, formatMWD } = context.helpers;

test('valid decimal amounts convert to exact cents', () => {
  for (const [input, expected] of [
    ['0.01', 1], ['1', 100], ['1.23', 123], ['1000.00', 100000],
    ['1000000', 100000000], ['2,50', 250], [' 3.25 ', 325],
  ]) assert.equal(amountToCents(input), expected, input);
});
test('invalid and out-of-range amounts fail closed', () => {
  for (const input of ['', '0', '0.00', '-1', '1.234', '1e3',
    '1,234.00', '1000000.01', 'abc', 'NaN', 'Infinity', '.5'])
    assert.equal(amountToCents(input), null, input);
});
test('formatted fictitious balances use two decimals', () => {
  assert.equal(formatMWD(123), '1.23');
  assert.equal(formatMWD(0), '0.00');
});
test('random request IDs are UUID v4 and do not collide in sample', () => {
  const ids = Array.from({ length: 500 }, () => uniqueRequestId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('missing secure randomness fails closed', () => {
  const noCrypto = vm.createContext({ Uint8Array, Number, Array, Error });
  vm.runInContext(source.slice(start, end) +
    '\nthis.makeId = uniqueRequestId;', noCrypto);
  assert.throws(() => noCrypto.makeId(), /generador de identificadores seguros/);
});
