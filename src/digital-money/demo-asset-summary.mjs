// Solo UI de DEMO: jamás convertir estos valores a USD ni sumar con MWD.
export function parseDemoAssetBalances(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (payload.mode !== 'sandbox_only' || payload.realPaymentsEnabled !== false ||
      payload.marketRateConnected !== false || payload.stableBackedByReserves !== false) return null;
  const result = {};
  for (const key of ['coinMicro', 'stableMicro']) {
    const value = payload[key];
    const number = typeof value === 'number' ? value :
      (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) ? Number(value) : NaN);
    if (!Number.isSafeInteger(number) || number < 0) return null;
    result[key] = number;
  }
  return result;
}

export function formatDemoMicro(value) {
  if (!Number.isSafeInteger(value) || value < 0) return '—';
  const whole = String(Math.floor(value / 1000000)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(value % 1000000).padStart(6, '0').replace(/0+$/, '').padEnd(2, '0');
  return whole + '.' + fraction;
}
