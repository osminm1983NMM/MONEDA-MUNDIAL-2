// Resumen local de seguimiento, alimentado por RPC de solo lectura owner-only.
// NO activa bancos, agentes ni pagos. El alcance es exclusivamente documental.
export function buildCountryReadinessOverview(partners = [], expiryRows = []) {
  const summary = new Map();
  const validPartners = Array.isArray(partners) ? partners : [];
  for (const partner of validPartners) {
    const code = partner?.country_code;
    if (!/^[A-Z]{2}$/.test(code || '') || partner.review_status === 'archived') continue;
    if (!summary.has(code)) summary.set(code, {
      countryCode: code, candidates: 0, underReview: 0,
      documentsReviewed: 0, expired: 0, dueSoon: 0, missingDates: 0,
      realPaymentsEnabled: false
    });
    const s = summary.get(code);
    s.candidates++;
    if (partner.review_status === 'under_review' || partner.review_status === 'needs_changes') s.underReview++;
    if (partner.review_status === 'documented') s.documentsReviewed++;
  }
  const known = new Map(validPartners.map(p => [p.id, p]));
  for (const row of Array.isArray(expiryRows) ? expiryRows : []) {
    const partner = known.get(row?.partner_id);
    if (!partner || partner.review_status === 'archived') continue;
    const s = summary.get(partner.country_code);
    if (!s) continue;
    if (row.alert_level === 'expired') s.expired++;
    else if (row.alert_level === 'due_soon' || row.alert_level === 'due_within_window') s.dueSoon++;
    else if (row.alert_level === 'missing_date') s.missingDates++;
  }
  return [...summary.values()].sort((a,b) => a.countryCode.localeCompare(b.countryCode));
}
