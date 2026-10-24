// Modelo de presentación del historial reciente. Nunca modifica operaciones ni saldos.
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export const RECENT_HISTORY_FILTERS = Object.freeze(['all', 'incoming', 'outgoing', 'merchant']);

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
