// Moneda Mundial 2.0 — vista previa educativa de retiro en efectivo.
// Un código local de DEMOSTRACIÓN NO representa una remesa fondeada,
// una autorización de cobro ni un instrumento válido para bancos o agentes.
// Esta utilidad no consulta ni modifica Supabase y no almacena datos personales.
export const CASH_PICKUP_DEMO_DESTINATIONS = Object.freeze([
  Object.freeze({ code: 'NI', name: 'Nicaragua', partnerEnabled: false, realPaymentsEnabled: false }),
]);

const BYTES_IN_SAMPLE_CODE = 12; // 96 bits aleatorios: solo para un ejemplo no cobrable.

export function createCashPickupDemo({ destination = 'NI', amountCents } = {}, randomBytes) {
  const country = CASH_PICKUP_DEMO_DESTINATIONS.find(item => item.code === destination);
  if (!country || !Number.isSafeInteger(amountCents) ||
      amountCents < 100 || amountCents > 10000000) return null;
  // Nunca sustituir un generador criptográfico ausente por Math.random.
  if (!(randomBytes instanceof Uint8Array) || randomBytes.length !== BYTES_IN_SAMPLE_CODE) {
    throw new Error('El generador seguro de códigos no está disponible.');
  }
  const hex = Array.from(randomBytes, n => n.toString(16).padStart(2,'0')).join('').toUpperCase();
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
  return cryptoSource.getRandomValues(new Uint8Array(BYTES_IN_SAMPLE_CODE));
}
