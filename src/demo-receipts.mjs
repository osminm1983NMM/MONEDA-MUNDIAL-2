// Comprobantes exclusivamente para créditos ficticios MWD; no son documentos bancarios.
import { formatMWD } from './demo-money.mjs';

export function classifyDemoOperation(op, currentUserId) {
  if (!op || typeof currentUserId !== 'string' || !currentUserId) return null;
  const sent = op.source_user_id === currentUserId;
  const received = op.destination_user_id === currentUserId;
  if (op.kind === 'contribution') {
    return sent ? { label: 'Aportación ficticia', sign: '-', direction: 'Salida' } : null;
  }
  if (op.kind !== 'transfer' || (!sent && !received)) return null;
  if (op.is_merchant_payment) {
    return sent
      ? { label: 'Pago ficticio a comercio', sign: '-', direction: 'Salida' }
      : { label: 'Cobro ficticio de comercio', sign: '+', direction: 'Entrada' };
  }
  return sent
    ? { label: 'Transferencia enviada', sign: '-', direction: 'Salida' }
    : { label: 'Transferencia recibida', sign: '+', direction: 'Entrada' };
}

export function formatDemoReceipt(op, currentUserId) {
  const movement = classifyDemoOperation(op, currentUserId);
  const cents = Number(op?.amount_cents);
  const time = new Date(op?.created_at);
  if (!movement || !Number.isSafeInteger(cents) || cents < 1 ||
      typeof op.id !== 'string' ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(op.id) ||
      Number.isNaN(time.getTime())) return null;

  return [
    'MONEDA MUNDIAL 2.0',
    'COMPROBANTE DE DEMOSTRACIÓN',
    'SIN VALOR FINANCIERO · SIN DINERO REAL',
    '',
    'Movimiento: ' + movement.label,
    'Importe: ' + movement.sign + formatMWD(cents) + ' MWD ficticios',
    'Dirección: ' + movement.direction,
    'Fecha: ' + time.toLocaleString(),
    'Referencia de prueba: ' + op.id,
    '',
    'Registro interno de simulación. No es comprobante bancario',
    'ni demuestra pago o transferencia de dinero real.',
  ].join('\n');
}
