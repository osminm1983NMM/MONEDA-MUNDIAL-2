const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('RemittanceDemoScreen.js', 'utf8');
const start = source.indexOf('const parseCents =');
const end = source.indexOf('const uuid =', start);
assert.ok(start >= 0 && end > start, 'Amount parser must exist');
const parseCents = vm.runInNewContext(source.slice(start, end) + '\nparseCents');

test('valid dollar amounts become exact integer cents', () => {
  for (const [input, expected] of [
    ['1', 100], ['1.00', 100], ['100.00', 10000],
    ['100,25', 10025], ['0.99', null], ['99999.99', 9999999],
    ['100000', 10000000], ['100000.01', null],
    [' 2.5 ', 250], ['0002.05', 205]
  ]) assert.equal(parseCents(input), expected, input);
});

test('invalid formats and oversized amounts are rejected', () => {
  for (const input of ['', 'abc', '1.234', '-1', '1e3', '1,2.3', '1.2.3', '1,000.00', '100001', '0', '.99'])
    assert.equal(parseCents(input), null, input);
});
