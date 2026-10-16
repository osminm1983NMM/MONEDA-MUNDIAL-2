// Prioridades DOCUMENTALES para el propietario de Moneda Mundial 2.0.
// Los estados aquí no prueban licencias, convenios ni pagos reales.
// Función pura y determinista: no altera Supabase ni billeteras.
const RANK = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3 });
const DOCUMENT_LABELS = Object.freeze({
  regulatory_license: 'Licencia regulatoria',
  signed_agreement: 'Contrato de colaboración',
  jurisdiction_permissions: 'Permisos del país'
});
const VALID_ALERT = new Set(['expired','due_soon','due_within_window','missing_date']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PRODUCTION_GATES = Object.freeze([
  Object.freeze({ id: 'legal-licenses', category: 'Legal', name: 'Verificar licencias y permisos vigentes por jurisdicción', status: 'not_verified' }),
  Object.freeze({ id: 'finance-partners', category: 'Financiero', name: 'Formalizar convenios y financiación de pagos con socios regulados', status: 'not_verified' }),
  Object.freeze({ id: 'finance-controls', category: 'Financiero', name: 'Evaluar KYC, AML, sanciones, liquidación y conciliación', status: 'not_verified' }),
  Object.freeze({ id: 'tech-agent', category: 'Técnico', name: 'Probar integraciones seguras y cobro único con un agente autorizado', status: 'not_verified' }),
  Object.freeze({ id: 'tech-android', category: 'Técnico', name: 'Validar la versión Android y sus flujos de prueba', status: 'not_verified' }),
]);

function text(value) { return typeof value === 'string' ? value : ''; }
function dateValue(value) {
  return ISO_DATE.test(text(value)) ? value : null;
}
function task(key, priority, category, title, nextAction, countryCode = null, dueDate = null) {
  return { key, priority, category, title, nextAction, countryCode, dueDate, realPaymentsEnabled: false };
}

export function buildPartnerPriorityQueue({
  partners = [], expiryRows = [], activities = [], activitiesAvailable = false,
} = {}) {
  const candidates = Array.isArray(partners) ? partners : [];
  const registry = new Map();
  for (const p of candidates) {
    if (typeof p?.id !== 'string' || !/^[A-Z]{2}$/.test(p.country_code || '') ||
        p.review_status === 'archived') continue;
    registry.set(p.id, p);
  }
  const rows = [];
  for (const record of Array.isArray(expiryRows) ? expiryRows : []) {
    const p = registry.get(record?.partner_id);
    if (!p || !VALID_ALERT.has(record?.alert_level) ||
        !Object.hasOwn(DOCUMENT_LABELS, record.requirement_type)) continue;
    const document = DOCUMENT_LABELS[record.requirement_type];
    const severity = record.alert_level === 'expired' ? 'critical'
      : record.alert_level === 'due_soon' ? 'high'
      : record.alert_level === 'due_within_window' ? 'medium' : 'medium';
    const action = record.alert_level === 'expired'
      ? 'Solicitar revisión de vigencia y renovación; no utilizar para habilitar pagos.'
      : record.alert_level === 'missing_date'
        ? 'Registrar fecha documental de referencia y validar la información.'
        : 'Preparar la revisión del vencimiento; confirmar con la entidad autorizada.';
    rows.push(task('document:' + p.id + ':' + record.requirement_type,
      severity, 'Legal', p.legal_name + ' · ' + document + ' · ' + record.alert_level,
      action, p.country_code, dateValue(record.valid_until)));
  }
  if (activitiesAvailable) {
    for (const a of Array.isArray(activities) ? activities : []) {
      const p = registry.get(a?.partner_id);
      if (!p || a.activity_status !== 'planned' || !dateValue(a.due_on)) continue;
      rows.push(task('activity:' + a.id, 'medium', 'Administración',
        p.legal_name + ' · ' + text(a.title),
        'Revisar la tarea interna y actualizar su estado cuando corresponda.',
        p.country_code, a.due_on));
    }
  }
  for (const p of registry.values()) {
    if (p.review_status === 'draft' || p.review_status === 'needs_changes') {
      rows.push(task('review:' + p.id, 'medium', 'Administración',
        p.legal_name + ' · registro por revisar',
        'Revisar documentos; una revisión interna no certifica autorización.',
        p.country_code));
    }
  }
  rows.sort((a,b) => RANK[a.priority]-RANK[b.priority] ||
    (a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31') ||
    a.key.localeCompare(b.key));
  return Object.freeze({
    candidateCount: registry.size,
    urgentCount: rows.filter(x => x.priority==='critical').length,
    highCount: rows.filter(x => x.priority==='high').length,
    priorities: rows.slice(0,40),
    omitted: Math.max(rows.length-40,0),
    productionGates: PRODUCTION_GATES,
    activitiesAvailable: Boolean(activitiesAvailable),
    realPaymentsEnabled: false,
    approvedBanks: 0,
  });
}
