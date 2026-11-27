'use strict';

// Normalized synthetic event contract shared by the worker and the local inbox.
const isProviderEventId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const isReference = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

function normalizeVerifiedEvent(event, providerId) {
  if (!event || event.mode !== 'sandbox' || event.provider !== providerId ||
      !isProviderEventId(event.eventId) || !isReference(event.orderId) ||
      !isReference(event.reference) || !Number.isSafeInteger(event.amountMinor) || event.amountMinor <= 0) return null;
  const type = typeof event.type === 'string' && /^(funding|payout|refund)_(confirmed|failed)$/.exec(event.type);
  if (!type || event.reference !== event.orderId + '-' + type[1] ||
      event.currency !== (type[1] === 'payout' ? 'HNL' : 'USD')) return null;
  return {
    provider: providerId,
    eventId: event.eventId,
    reference: event.reference,
    outcome: type[2],
    currency: event.currency,
    amountMinor: event.amountMinor,
  };
}

module.exports = { isProviderEventId, normalizeVerifiedEvent };
