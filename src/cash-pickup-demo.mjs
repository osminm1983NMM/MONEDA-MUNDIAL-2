// Moneda Mundial 2.0 — alcance mundial de la modalidad de retiro de efectivo.
// Todos los países del catálogo son DESTINOS DE DISEÑO, no corredores habilitados.
// Las referencias DEMO-* son ejemplos locales NO cobrables; no viajan a Supabase.
const SAMPLE_BYTES = 12; // 96 bits; una referencia de prueba NO se usa para pagar.
const COUNTRY_CODE = /^[A-Z]{2}$/;

export function normalizeCashPickupCountries(worldCatalog) {
  if (!Array.isArray(worldCatalog)) return [];
  const seen = new Set();
  const countries = [];
  for (const entry of worldCatalog) {
    const code = entry?.code;
    const name = entry?.name;
    if (typeof code !== 'string' || !COUNTRY_CODE.test(code) ||
        typeof name !== 'string' || !name.trim() || seen.has(code)) continue;
    seen.add(code);
    // NO transportar el 'demoAvailable' del cotizador ni confundirlo con cash pickup.
    // Ignorar cualquier aparente habilitación de pago real en datos cliente.
    countries.push(Object.freeze({
      code, name: name.trim(),
      cashPickupDesignAvailable: true,
      cashPickupRealEnabled: false,
      partnerAvailable: false,
    }));
  }
  return countries;
}

export function createCashPickupDemo({
  origin = 'US', destination = 'NI', amountCents, worldCatalog,
} = {}, randomBytes) {
  if (origin !== 'US' || typeof destination !== 'string' ||
      !COUNTRY_CODE.test(destination) ||
      !Number.isSafeInteger(amountCents) || amountCents < 100 ||
      amountCents > 10000000) return null;
  // Sin catálogo mundial confirmado, NO emitir siquiera referencia de ejemplo.
  const country = normalizeCashPickupCountries(worldCatalog)
    .find(item => item.code === destination);
  if (!country) return null;
  if (!(randomBytes instanceof Uint8Array) || randomBytes.length !== SAMPLE_BYTES) {
    throw new Error('El generador seguro de códigos no está disponible.');
  }
  const hex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return Object.freeze({
    kind: 'cash_pickup_demo',
    status: 'sample_not_redeemable',
    referenceCode: 'DEMO-' + destination + '-' + hex,
    origin: 'US',
    sourceCurrency: 'USD',
    destination,
    countryName: country.name,
    amountCents,
    payoutAmountCents: null,
    payoutCurrency: null,
    exchangeRate: null,
    feeCents: null,
    totalChargeCents: null,
    partnerEnabled: false,
    funded: false,
    identityVerified: false,
    realPaymentsEnabled: false,
    redeemable: false,
    backendRegistered: false,
  });
}

export function generateCashPickupSampleBytes(cryptoSource) {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('El generador seguro de códigos no está disponible.');
  }
  return cryptoSource.getRandomValues(new Uint8Array(SAMPLE_BYTES));
}
