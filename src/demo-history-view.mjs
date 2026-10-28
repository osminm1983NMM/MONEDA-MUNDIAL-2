// Modelo de presentación del historial reciente. Nunca modifica operaciones ni saldos.
import {formatMWD} from './demo-money.mjs';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export const RECENT_HISTORY_FILTERS = Object.freeze(['all', 'incoming', 'outgoing', 'merchant']);

// El historial paginado usa direcciones en español. Las aportaciones y envíos
// deben mostrarse como débitos, igual que en el historial reciente.
export function pagedDemoAmountTone(direction) {
  return direction === 'recibido' ? 'credit' : 'debit';
}

export function prepareRecentDemoHistory(operations, userId, classify) {
  if (!Array.isArray(operations) || !userId || typeof classify !== 'function') return [];
  return operations.flatMap(op => {
    if (!op || typeof op.id !== 'string' || !UUID.test(op.id) ||
        !Number.isSafeInteger(op.amount_cents) || op.amount_cents < 1 ||
        !op.created_at || Number.isNaN(Date.parse(op.created_at))) return [];
    const movement = classify(op, userId);
    if (!movement || (movement.sign !== '+' && movement.sign !== '-')) return [];
    return [{
      id: op.id, operation: op, movement,
      direction: movement.sign === '+' ? 'incoming' : 'outgoing',
      merchant: Boolean(op.is_merchant_payment),
    }];
  });
}

export function summarizeRecentDemoHistory(rows) {
  return rows.reduce((totals, row) => {
    if (row.direction === 'incoming') {
      totals.incomingCents += row.operation.amount_cents;
      totals.incomingCount += 1;
    } else {
      totals.outgoingCents += row.operation.amount_cents;
      totals.outgoingCount += 1;
    }
    return totals;
  }, {incomingCents: 0, outgoingCents: 0, incomingCount: 0, outgoingCount: 0});
}

export function filterRecentDemoHistory(rows, filter) {
  if (filter === 'incoming' || filter === 'outgoing') {
    return rows.filter(row => row.direction === filter);
  }
  if (filter === 'merchant') return rows.filter(row => row.merchant);
  return rows;
}

/**
 * Una consulta paginada a mwd_operations no contiene el indicador de comercio.
 * Sólo mostramos esa clasificación cuando una operación reciente, recibida de
 * mwd_history_demo para la MISMA sesión, coincide en id, tipo, monto y fecha.
 * Nunca inferimos un pago comercial de un simple envío o de datos ajenos.
 */
export function verifiedPagedMerchantDirection(pageRow, recentOperations, userId) {
  if (!pageRow || !Array.isArray(recentOperations) || !userId ||
      pageRow.kind !== 'transfer' || !UUID.test(String(pageRow.id || ''))) return null;
  const recent = recentOperations.find(op => op?.id === pageRow.id);
  if (!recent || recent.kind !== 'transfer' || recent.is_merchant_payment !== true ||
      !Number.isSafeInteger(recent.amount_cents) || recent.amount_cents < 1 ||
      formatMWD(recent.amount_cents) !== pageRow.amountMwd ||
      !pageRow.createdAt || !recent.created_at ||
      !Number.isFinite(Date.parse(pageRow.createdAt)) ||
      Date.parse(pageRow.createdAt) !== Date.parse(recent.created_at)) return null;
  if (pageRow.direction === 'enviado' && recent.source_user_id === userId)
    return 'merchantSent';
  if (pageRow.direction === 'recibido' && recent.destination_user_id === userId)
    return 'merchantReceived';
  return null;
}
