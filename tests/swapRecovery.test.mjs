// Ejecutar localmente: node --test tests/swapRecovery.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../swapRecovery.js', import.meta.url), 'utf8');
const { reconcileSwapQuote, swapRecoveryAction } =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));
const quoteId = '11111111-1111-4111-8111-111111111111';
function mock(data, error = null) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data, error };
    },
  };
}
for (const status of ['executed', 'quoted', 'expired']) {
  test('consulta sin escribir: ' + status, async () => {
    const db = mock({ quoteId, status, conversionId: status === 'executed' ? 'receipt' : null, realPaymentsEnabled: false });
    const result = await reconcileSwapQuote(db, quoteId);
    assert.equal(result.status, status);
    assert.deepEqual(db.calls, [{
      name: 'mwd_conversion_reconcile_demo',
      args: { p_quote_id: quoteId },
    }]);
  });
}
test('rechaza cotización ajena o respuesta incorrecta', async () => {
  await assert.rejects(reconcileSwapQuote(mock({ quoteId: 'different', status: 'executed', conversionId: 'receipt', realPaymentsEnabled: false }), quoteId));
});
test('rechaza ejecución sin comprobante', async () => {
  await assert.rejects(reconcileSwapQuote(mock({ quoteId, status: 'executed', realPaymentsEnabled: false }), quoteId));
});
test('propaga errores de conexión', async () => {
  await assert.rejects(reconcileSwapQuote(mock(null, new Error('offline')), quoteId), /offline/);
});
test('reintento solo cuando sigue cotizada', () => {
  assert.equal(swapRecoveryAction('quoted'), 'retry_same_quote');
  assert.equal(swapRecoveryAction('executed'), 'refresh_wallet');
  assert.equal(swapRecoveryAction('expired'), 'request_new_quote');
  assert.equal(swapRecoveryAction('unknown'), 'manual_review');
});
