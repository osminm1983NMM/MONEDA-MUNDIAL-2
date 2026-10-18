import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDemoAssetBalances, formatDemoMicro } from '../src/digital-money/demo-asset-summary.mjs';

const valid = {
  mode: 'sandbox_only',
  realPaymentsEnabled: false,
  marketRateConnected: false,
  stableBackedByReserves: false,
  coinMicro: 100000000,
  stableMicro: 1000000000,
};

test('Separación de Coin y Digital y valores exactos de prueba', () => {
  assert.deepEqual(parseDemoAssetBalances(valid), { coinMicro: 100000000, stableMicro: 1000000000 });
  assert.deepEqual(parseDemoAssetBalances({ ...valid, coinMicro: '1234567', stableMicro: '0' }),
    { coinMicro: 1234567, stableMicro: 0 });
  assert.equal(formatDemoMicro(1234567), '1.234567');
  assert.equal(formatDemoMicro(1000000), '1.00');
  assert.equal(formatDemoMicro(0), '0.00');
  assert.equal(formatDemoMicro(12345678900), '12,345.6789');
});

test('No mostrar importes ante datos inválidos ni modo real', () => {
  for (const change of [
    { mode: 'live' }, { realPaymentsEnabled: true },
    { marketRateConnected: true }, { stableBackedByReserves: true },
    { coinMicro: -1 }, { coinMicro: 1.1 }, { coinMicro: '1.5' },
    { coinMicro: null }, { coinMicro: Number.MAX_SAFE_INTEGER + 1 },
    { stableMicro: undefined }, { stableMicro: '1e3' },
  ]) assert.equal(parseDemoAssetBalances({ ...valid, ...change }), null, JSON.stringify(change));
  assert.equal(parseDemoAssetBalances(null), null);
  assert.equal(parseDemoAssetBalances({ coinMicro: 0, stableMicro: 0 }), null);
  assert.equal(formatDemoMicro(-1), '—');
});
