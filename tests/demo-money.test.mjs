import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DEMO_AMOUNT_CENTS,
  amountToCents,
  formatMWD,
  normalizeRecipientCode,
  normalizePaymentRequestId,
} from '../src/demo-money.mjs';

test('acepta montos válidos en centavos enteros', () => {
  const cases = {
    '0.01': 1,
    '0,09': 9,
    '1': 100,
    '1.2': 120,
    '999999.99': 99_999_999,
    ' 1000000.00 ': MAX_DEMO_AMOUNT_CENTS,
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(amountToCents(input), expected, input);
  }
});

test('rechaza valores negativos, cero, decimales excesivos y límite excedido', () => {
  for (const input of ['', '  ', '0', '0.00', '-1', '1.001', '1e3',
    'Infinity', 'NaN', '1,000.50', '1,00,0', '1000000.01', undefined, null]) {
    assert.equal(amountToCents(input), null, String(input));
  }
});

test('muestra montos ficticios con dos decimales', () => {
  assert.equal(formatMWD(0), '0.00');
  assert.equal(formatMWD(9), '0.09');
  assert.equal(formatMWD(12345), '123.45');
  assert.equal(formatMWD(100_000_000), '1000000.00');
});

test('normaliza y valida el identificador de destino', () => {
  assert.equal(normalizeRecipientCode(' mwd-0123456789abcdef '), 'MWD-0123456789ABCDEF');
  assert.equal(normalizeRecipientCode('MWD-0123456789ABCDE'), null);
  assert.equal(normalizeRecipientCode('MWD-0123456789ABCDEG'), null);
  assert.equal(normalizeRecipientCode(undefined), null);
});

test('normaliza y valida UUID de solicitud de cobro', () => {
  const id = '30D21390-94BE-4D29-88DF-234567891ABC';
  assert.equal(normalizePaymentRequestId(' ' + id + ' '), id.toLowerCase());
  assert.equal(normalizePaymentRequestId('30D21390-94BE-4D29-88DF-234567891ABG'), null);
  assert.equal(normalizePaymentRequestId(''), null);
  assert.equal(normalizePaymentRequestId(null), null);
});
