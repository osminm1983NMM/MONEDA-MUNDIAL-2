// Controles puros sobre respuestas asíncronas del entorno de demostración.
// No reemplazan la autorización, RLS ni las comprobaciones de Supabase.
export function isLatestRequest(startedSequence, currentSequence) {
  return Number.isSafeInteger(startedSequence) && startedSequence > 0
    && startedSequence === currentSequence;
}

// Una cotización para un destino anterior no puede presentarse con otro país,
// método o importe. Ninguna respuesta del cliente habilita dinero real.
export function isValidDemoQuoteResponse(q, request) {
  if (!q || !request || q.status !== 'simulation_only' ||
      q.realPaymentsEnabled !== false || q.origin !== 'US' ||
      q.sourceCurrency !== 'USD' || q.destination !== request.destination ||
      q.method !== request.method || q.amountCents !== request.amountCents ||
      !Number.isSafeInteger(q.amountCents) || q.amountCents < 100 ||
      !Number.isSafeInteger(q.feeCents) || q.feeCents < 0 ||
      !Number.isSafeInteger(q.totalPayCents) ||
      q.totalPayCents !== q.amountCents + q.feeCents ||
      typeof q.destinationCurrency !== 'string') return false;

  // Cuando no hay conversión cambiaria real, no mostrar monto receptor inventado.
  if (q.destinationCurrency !== 'USD') {
    return q.receiverAmountCents === null && q.fxRate === null;
  }
  return q.receiverAmountCents === q.amountCents && q.fxRate === 1;
}

export function isValidDemoPaymentPreview(preview, expectedId) {
  return Boolean(preview && typeof expectedId === 'string' &&
    preview.id === expectedId && preview.currency_code === 'MWD' &&
    Number.isSafeInteger(preview.amount_cents) &&
    preview.amount_cents >= 1 && preview.amount_cents <= 100000000 &&
    ['pending','paid','cancelled','expired'].includes(preview.status));
}
