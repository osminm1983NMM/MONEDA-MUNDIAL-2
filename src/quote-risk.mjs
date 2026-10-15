// Solo presenta advertencias sobre simulaciones. NO fija precios ni habilita pagos reales.
// En particular, no se interpreta una comisión mayor como permiso regulatorio.
export function needsDemoFeeReview(quote) {
  return quote?.status === 'simulation_only' &&
    quote?.realPaymentsEnabled === false &&
    Number.isSafeInteger(quote.illustrativeMarginCents) &&
    quote.illustrativeMarginCents < 0;
}

/** Diferencia ilustrativa para cubrir SOLO los costos variables cargados.
 * No incluye impuestos, FX, cumplimiento, fraude ni autoriza cobrar dinero real.
 */
export function demoFeeShortfallCents(quote) {
  if (!needsDemoFeeReview(quote)) return 0;
  if (!Number.isSafeInteger(quote.costEstimateCents) ||
      !Number.isSafeInteger(quote.feeCents)) return 0;
  return Math.max(0, quote.costEstimateCents - quote.feeCents);
}
