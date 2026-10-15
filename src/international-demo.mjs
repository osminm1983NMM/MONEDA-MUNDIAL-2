// Tarifas HIPOTÉTICAS para simulación; NO tarifas de mercado, FX real ni operaciones bancarias.
export const DEMO_CORRIDORS = Object.freeze([
  { code: 'GT', country: 'Guatemala', currency: 'GTQ', feeBps: 120, minFeeCents: 50, providerCostCents: 45, fxRate: null },
  { code: 'HN', country: 'Honduras', currency: 'HNL', feeBps: 110, minFeeCents: 50, providerCostCents: 48, fxRate: null },
  { code: 'SV', country: 'El Salvador', currency: 'USD', feeBps: 95, minFeeCents: 50, providerCostCents: 50, fxRate: 1 },
  { code: 'NI', country: 'Nicaragua', currency: 'NIO', feeBps: 130, minFeeCents: 60, providerCostCents: 55, fxRate: null },
  { code: 'CR', country: 'Costa Rica', currency: 'CRC', feeBps: 115, minFeeCents: 55, providerCostCents: 50, fxRate: null },
  { code: 'PA', country: 'Panamá', currency: 'USD', feeBps: 100, minFeeCents: 50, providerCostCents: 50, fxRate: 1 },
  { code: 'BZ', country: 'Belice', currency: 'BZD', feeBps: 125, minFeeCents: 60, providerCostCents: 50, fxRate: null },
  { code: 'EC', country: 'Ecuador', currency: 'USD', feeBps: 100, minFeeCents: 50, providerCostCents: 55, fxRate: 1 },
  { code: 'CO', country: 'Colombia', currency: 'COP', feeBps: 115, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'PE', country: 'Perú', currency: 'PEN', feeBps: 110, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'BO', country: 'Bolivia', currency: 'BOB', feeBps: 120, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'BR', country: 'Brasil', currency: 'BRL', feeBps: 115, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'PY', country: 'Paraguay', currency: 'PYG', feeBps: 120, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'CL', country: 'Chile', currency: 'CLP', feeBps: 110, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'AR', country: 'Argentina', currency: 'ARS', feeBps: 130, minFeeCents: 60, providerCostCents: 55, fxRate: null },
  { code: 'UY', country: 'Uruguay', currency: 'UYU', feeBps: 115, minFeeCents: 55, providerCostCents: 55, fxRate: null },
  { code: 'VE', country: 'Venezuela', currency: 'VES', feeBps: 140, minFeeCents: 60, providerCostCents: 60, fxRate: null },
  { code: 'GY', country: 'Guyana', currency: 'GYD', feeBps: 130, minFeeCents: 60, providerCostCents: 60, fxRate: null },
  { code: 'SR', country: 'Surinam', currency: 'SRD', feeBps: 130, minFeeCents: 60, providerCostCents: 60, fxRate: null },
]);
// Para rutas de otras divisas NO inventar ni usar una cotización de conversión.
// Otros costos omitidos: tarjeta, bancos, riesgo, KYC, impuestos, FX, proveedores y reembolsos.
// El cálculo de ganancia es ilustrativo y no determina si un servicio sería rentable.
export function quoteInternationalDemo({ origin = 'US', destination, amountCents, method = 'bank' }) {
  if (origin !== 'US' || !Number.isSafeInteger(amountCents) || amountCents < 100 ||
      amountCents > 100_000_00 || !['bank','card'].includes(method)) return null;
  const corridor = DEMO_CORRIDORS.find(x => x.code === destination);
  if (!corridor) return null;
  const methodCostCents = method === 'card' ? 250 : 0; // estimación ficticia, NO tarifa real.
  const feeCents = Math.max(corridor.minFeeCents, Math.ceil(amountCents * corridor.feeBps / 10_000));
  const estimatedVariableCostCents = corridor.providerCostCents + methodCostCents;
  return {
    origin, destination, country: corridor.country, sourceCurrency: 'USD',
    destinationCurrency: corridor.currency, method, amountCents, feeCents,
    totalPayCents: amountCents + feeCents,
    costEstimateCents: estimatedVariableCostCents,
    illustrativeMarginCents: feeCents - estimatedVariableCostCents,
    receiverAmountCents: corridor.currency === 'USD' ? amountCents : null,
    fxRate: corridor.fxRate,
    // Bloqueo explícito: ninguna simulación autoriza operaciones financieras reales.
    realPaymentsEnabled: false,
    status: 'simulation_only',
  };
}
