import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDemoOperation, formatDemoReceipt } from '../src/demo-receipts.mjs';

const owner = 'usuario-1';
const other = 'usuario-2';
const base = {
  id: 'f3f26e36-99d0-41e9-8670-cc6f48110f23',
  kind: 'transfer',
  source_user_id: owner,
  destination_user_id: other,
  amount_cents: 100,
  created_at: '2026-10-14T14:57:28Z',
};

test('distingue pago saliente a comercio de transferencia ordinaria', () => {
  const commercial = { ...base, is_merchant_payment: true };
  assert.equal(classifyDemoOperation(commercial, owner).label, 'Pago ficticio a comercio');
  assert.equal(classifyDemoOperation(commercial, other).label, 'Cobro ficticio de comercio');
  assert.equal(classifyDemoOperation(base, owner).label, 'Transferencia enviada');
  assert.equal(classifyDemoOperation(base, other).label, 'Transferencia recibida');
});

test('identifica correctamente aportaciones y dirección de movimientos', () => {
  const donation = { ...base, kind: 'contribution', destination_user_id: null };
  assert.deepEqual(classifyDemoOperation(donation, owner), {
    label: 'Aportación ficticia', sign: '-', direction: 'Salida',
  });
  assert.equal(classifyDemoOperation(donation, other), null);
});

test('crea recibo de prueba con identificador y advertencia de dinero ficticio', () => {
  const receipt = formatDemoReceipt({ ...base, is_merchant_payment: true }, owner);
  assert.match(receipt, /Pago ficticio a comercio/);
  assert.match(receipt, /-1\.00 MWD ficticios/);
  assert.match(receipt, /f3f26e36-99d0-41e9-8670-cc6f48110f23/);
  assert.match(receipt, /SIN DINERO REAL/);
  assert.doesNotMatch(receipt, /usuario-1|usuario-2/);
});

test('no genera comprobantes de cuentas ajenas o datos malformados', () => {
  assert.equal(formatDemoReceipt(base, 'tercero'), null);
  assert.equal(formatDemoReceipt({ ...base, id: 'invalido' }, owner), null);
  assert.equal(formatDemoReceipt({ ...base, amount_cents: -1 }, owner), null);
  assert.equal(formatDemoReceipt({ ...base, created_at: 'invalida' }, owner), null);
});
