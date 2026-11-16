// Validación pura de intenciones de reintento ficticias. Sin lectura/escritura local ni RPC.
// Diseñado para probarse antes de integrar AsyncStorage en Android.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATES = ['draft', 'review'];
const isPlainObject = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function validatePendingRemittance(value, currentUserId) {
  if (!isPlainObject(value) || typeof currentUserId !== 'string' || !UUID_V4.test(currentUserId)) return null;
  if (value.version !== 1 || value.userId !== currentUserId || !UUID_V4.test(value.requestId || '')) return null;
  if (typeof value.createdAt !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T/.test(value.createdAt) ||
      !Number.isFinite(Date.parse(value.createdAt))) return null;
  if (value.kind === 'create') {
    if (value.destination !== 'HN' || !Number.isSafeInteger(value.cents) || value.cents < 100 || value.cents > 10000000 ||
        value.orderId !== undefined || value.next !== undefined) return null;
    return { version: 1, userId: value.userId, kind: 'create', requestId: value.requestId,
      destination: 'HN', cents: value.cents, createdAt: value.createdAt };
  }
  if (value.kind === 'transition') {
    if (!UUID_V4.test(value.orderId || '') || !['review', 'simulated', 'cancelled'].includes(value.next) ||
        value.destination !== undefined || value.cents !== undefined) return null;
    if (value.from !== undefined && (!VALID_STATES.includes(value.from) ||
        !(value.from === 'draft' ? ['review', 'cancelled'] : ['simulated', 'cancelled']).includes(value.next))) return null;
    return { version: 1, userId: value.userId, kind: 'transition', requestId: value.requestId,
      orderId: value.orderId, next: value.next, createdAt: value.createdAt };
  }
  return null;
}

module.exports = { validatePendingRemittance };
