import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../App.js', import.meta.url), 'utf8');

test('Android consulta la conciliación de conversiones', () => {
  assert.match(app, /supabase\.rpc\('mwd_conversion_reconcile_demo'/);
  assert.match(app, /async function reconcileSwap\(quoteId\)/);
});

test('el reintento usa el identificador original', () => {
  assert.match(app, /p_quote_id: quote\.quoteId/);
  assert.match(app, /const state = await reconcileSwap\(quote\.quoteId\)/);
});

test('los saldos se consultan antes de anunciar recuperación', () => {
  assert.match(app, /walletResponse\.error\) throw walletResponse\.error/);
  assert.match(app, /recovered \? 'Conversión recuperada' : 'Conversión ficticia'/);
});

test('la aplicación continúa en modo de demostración', () => {
  assert.match(app, /SOLO DEMOSTRACIÓN/);
  assert.match(app, /realPaymentsEnabled !== false/);
});

test('conversión confirmada se distingue de error de actualización de saldo', () => {
  assert.match(app, /async function showExecutedSwap\(recovered\)/);
  assert.match(app, /await showExecutedSwap\(data\.status === 'already_processed'\)/);
  assert.match(app, /message\('Conversión confirmada'/);
  assert.match(app, /setSwapWallet\(null\)/);
});

test('acepta montos decimales correctos para cotización', () => {
  const match = app.match(/if \(!\/(\^\(\?:0\|\[1-9\].*?)\/\.test\(normalized\)\)/);
  assert.ok(match, 'Debe existir validación de monto');
  const pattern = new RegExp(match[1]);
  for (const amount of ['1', '2.75', '10.50', '10000.000001']) {
    assert.equal(pattern.test(amount), true, amount);
  }
  for (const amount of ['-1', '1.1234567', 'abc', '1,2', '']) {
    assert.equal(pattern.test(amount), false, amount);
  }
});

test('no descarta la cotización anterior antes de recibir otra', () => {
  const start = app.indexOf('  async function requestSwapQuote()');
  const end = app.indexOf('  async function reconcileSwap(', start);
  assert.ok(start >= 0 && end > start);
  const request = app.slice(start, end);
  assert.doesNotMatch(request, /setSwapBusy\(true\);\s*setSwapQuote\(null\)/);
  assert.match(request, /if \(error\) throw error;\s*setSwapQuote\(data\)/);
});
