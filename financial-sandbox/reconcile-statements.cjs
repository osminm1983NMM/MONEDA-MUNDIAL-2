'use strict';
// Offline sandbox only. No network, no credentials, no settlement side effects.
// Compare complete, same-window snapshots independently of webhook acceptance.
const kinds = new Set(['funding','payout','refund']);
const states = new Set(['pending','confirmed','failed']);
const id = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
function valid(r) {
  return r && r.mode === 'sandbox' && id(r.reference) && kinds.has(r.kind) &&
    states.has(r.status) && Number.isSafeInteger(r.amountMinor) && r.amountMinor > 0 &&
    r.currency === (r.kind === 'payout' ? 'HNL' : 'USD');
}
function reconcileStatements({environment, internal, statement, complete}) {
  if (environment !== 'sandbox') throw Error('SANDBOX_ONLY');
  if (!Array.isArray(internal) || !Array.isArray(statement) || internal.length > 100000 || statement.length > 100000) throw Error('INVALID_SNAPSHOT');
  const issues = [], totals = {USD: 0n,HNL: 0n};
  if (complete !== true) issues.push({code:'INCOMPLETE_SNAPSHOT'});
  function index(rows, side) {
    const map = new Map(), duplicates = new Set(), seen = new Set();
    for (const [index,r] of rows.entries()) {
      // Even a malformed row with a recognizable reference makes that reference
      // ambiguous. Never include another row for it in matched cash flow.
      if (r && id(r.reference)) {
        if (seen.has(r.reference)) {
          duplicates.add(r.reference);
          issues.push({code:'DUPLICATE_REFERENCE',side,reference:r.reference});
        }
        seen.add(r.reference);
      }
      if (!valid(r)) {issues.push({code:'INVALID_ROW',side,index});continue;}
      if (!map.has(r.reference)) map.set(r.reference,r);
    }
    return {map,duplicates};
  }
  const left = index(internal,'internal'), right = index(statement,'provider');
  for (const reference of new Set([...left.map.keys(),...right.map.keys()])) {
    if (left.duplicates.has(reference) || right.duplicates.has(reference)) continue;
    const a = left.map.get(reference), b = right.map.get(reference);
    if (!a || !b) {issues.push({code:a?'MISSING_PROVIDER':'UNKNOWN_PROVIDER',reference});continue;}
    if (a.kind !== b.kind || a.currency !== b.currency || a.amountMinor !== b.amountMinor) {
      issues.push({code:'VALUE_MISMATCH',reference});continue;
    }
    if (a.status !== b.status) {issues.push({code:'STATUS_MISMATCH',reference});continue;}
    if (a.status === 'pending') {issues.push({code:'UNRESOLVED_PENDING',reference});continue;}
    if (a.status === 'confirmed') totals[a.currency] += BigInt(a.amountMinor) * (a.kind === 'funding' ? 1n : -1n);
  }
  return {mode:'sandbox',clean:issues.length===0,issues,matchedConfirmedNetMinor:{USD:String(totals.USD),HNL:String(totals.HNL)}};
}
module.exports = {reconcileStatements};
