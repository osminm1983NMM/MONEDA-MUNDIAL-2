// Validaciones compartidas del registro de socios (solo demostración).
export function validPartner(name, country) {
  const n = (name || '').trim();
  const c = (country || '').trim();
  return n.length >= 2 && n.length <= 150 && /^[A-Za-z]{2}$/.test(c);
}
export function validLocation(branchName, city, currency, hours) {
  const b = (branchName || '').trim();
  const c = (city || '').trim();
  const m = (currency || '').trim();
  const h = hours || '';
  return b.length >= 2 && b.length <= 140 &&
    c.length >= 2 && c.length <= 100 &&
    /^[A-Za-z]{3}$/.test(m) && h.length <= 140;
}
