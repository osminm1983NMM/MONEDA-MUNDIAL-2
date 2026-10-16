// Proyección de solo lectura para enlazar candidatos financieros con la
// modalidad de retiro de efectivo DEMO. No genera códigos ni autorizaciones.
// Los datos proceden del registro restringido al propietario en Supabase.
const COUNTRY = /^[A-Z]{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
const STATUSES = new Set(['draft','under_review','needs_changes','documented','archived']);

export function summarizeRegisteredPickupCandidates(partners = []) {
  const rows = Array.isArray(partners) ? partners : [];
  const countries = new Set();
  let activeCandidateCount = 0;
  let archivedCandidateCount = 0;
  for (const row of rows) {
    if (!row || !COUNTRY.test(row.country_code || '') ||
        !STATUSES.has(row.review_status) || typeof row.id !== 'string') continue;
    if (row.review_status === 'archived') {
      archivedCandidateCount += 1;
      continue;
    }
    activeCandidateCount += 1;
    countries.add(row.country_code);
  }
  return Object.freeze({
    activeCandidateCount,
    archivedCandidateCount,
    countriesWithCandidates: countries.size,
    countriesWithAuthorizedPayouts: 0,
    authorizedPartners: 0,
    authorizedBranches: 0,
    realPaymentsEnabled: false,
  });
}

export function projectRegisteredPickupDesign(partner, locations = []) {
  if (!partner || typeof partner.id !== 'string' ||
      !COUNTRY.test(partner.country_code || '') ||
      !STATUSES.has(partner.review_status)) return null;
  const branches = Array.isArray(locations) ? locations : [];
  const currencyCodes = [...new Set(branches
    .filter(l => l && typeof l.id === 'string' && l.review_status === 'draft' &&
      CURRENCY.test(l.currency_code || ''))
    .map(l => l.currency_code))].sort();
  const draftBranches = branches.filter(l => l &&
    typeof l.id === 'string' && l.review_status === 'draft');
  return Object.freeze({
    destinationCountry: partner.country_code,
    reviewStatus: partner.review_status,
    branchDraftCount: draftBranches.length,
    suggestedCurrencies: Object.freeze(currencyCodes),
    // Un archivado no es un candidato activo. En cualquier estado el retiro real
    // sigue bloqueado; incluso 'documented' NO significa autorizado.
    canPreviewFictionalScenario: partner.review_status !== 'archived',
    financialPartnerAuthorized: false,
    cashPickupAgentAuthorized: false,
    realPaymentsEnabled: false,
    redeemableCodeAvailable: false,
    cashDisbursementAvailable: false,
  });
}
