// Fechas declaradas de vencimiento (solo metadatos de demostración).
// Se manejan como días civiles ISO, sin conversiones por zona horaria.
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parsePartnerExpiryDate(value) {
  const input = String(value ?? '').trim();
  if (input === '') return { valid: true, date: null };
  const match = DATE_PATTERN.exec(input);
  if (!match) return { valid: false, date: null };
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31)
    return { valid: false, date: null };
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC interpreta 1900-2100 de manera segura; evitar normalización silenciosa.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return { valid: false, date: null };
  return { valid: true, date: input };
}

export function classifyPartnerExpiry(dateValue, todayISO, days = 60) {
  if (dateValue === null || dateValue === '') return 'missing_date';
  const expiry = parsePartnerExpiryDate(dateValue);
  const today = parsePartnerExpiryDate(todayISO);
  if (!expiry.valid || !expiry.date || !today.valid || !today.date ||
      !Number.isInteger(days) || days < 30 || days > 365) return 'invalid';
  const e = Date.parse(expiry.date + 'T00:00:00Z');
  const t = Date.parse(today.date + 'T00:00:00Z');
  const delta = Math.round((e - t) / 86400000);
  if (delta < 0) return 'expired';
  if (delta <= 30) return 'due_soon';
  if (delta <= days) return 'due_within_window';
  return 'later';
}
