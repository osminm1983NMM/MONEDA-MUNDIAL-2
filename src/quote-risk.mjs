// Solo presenta advertencias sobre simulaciones. NO fija precios ni habilita pagos reales.
// En particular, no se interpreta una comisión mayor como permiso regulatorio.
export function needsDemoFeeReview(quote) {
  return quote?.status === 'simulation_only' &&
    quote?.realPaymentsEnabled === false &&
    Number.isSafeInteger(quote.illustrativeMarginCents) &&
    quote.illustrativeMarginCents < 0;
}
