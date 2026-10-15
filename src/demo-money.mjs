// Utilidades puras para operaciones de demostración. No manejan dinero real.
export const MAX_DEMO_AMOUNT_CENTS = 100_000_000;

export function amountToCents(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_DEMO_AMOUNT_CENTS) return null;
  return cents;
}

export function formatMWD(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export function normalizeRecipientCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^MWD-[A-F0-9]{16}$/.test(code) ? code : null;
}

export function normalizePaymentRequestId(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code)
    ? code : null;
}
