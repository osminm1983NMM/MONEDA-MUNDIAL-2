// Matriz informativa de CANDIDATOS para el propietario de Moneda Mundial.
// No es un certificado de licencias, no aprueba agentes y no habilita pagos.
const ISO2=/^[A-Z]{2}$/;
const STATUSES=new Set(['draft','under_review','needs_changes','documented','archived']);
const MAX_COUNT=100000;
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_COUNT;

function rowFromServer(row){
  if(!row||typeof row.partner_id!=='string'||!row.partner_id.trim()||
    typeof row.partner_name!=='string'||!row.partner_name.trim()||
    !ISO2.test(row.country_code||'')||!STATUSES.has(row.partner_status)||
    row.partner_status==='archived')return null;
  const fields=['branch_drafts','requirement_count','pending_requirements',
    'internally_reviewed','expired_requirements','due_30_requirements','missing_critical_dates'];
  if(fields.some(name=>!nonnegative(row[name])))return null;
  if(row.requirement_count!==10||
    row.pending_requirements+row.internally_reviewed!==row.requirement_count||
    row.expired_requirements>row.requirement_count||
    row.due_30_requirements>row.requirement_count||
    row.missing_critical_dates>3)return null;
  const attention=row.expired_requirements>0?'critical':
    row.missing_critical_dates>0?'high':
    row.pending_requirements>0||row.due_30_requirements>0?'medium':'external';
  return Object.freeze({
    id:row.partner_id,
    name:row.partner_name.trim(),
    countryCode:row.country_code,
    type:typeof row.partner_kind==='string'?row.partner_kind:'unknown',
    internalStatus:row.partner_status,
    proposedBranches:row.branch_drafts,
    requirements:row.requirement_count,
    internallyReviewed:row.internally_reviewed,
    pendingRequirements:row.pending_requirements,
    expiredRequirements:row.expired_requirements,
    due30Requirements:row.due_30_requirements,
    missingCriticalDates:row.missing_critical_dates,
    attention,
    // El servidor solo describe una preparación documental. Nunca autoriza retiros.
    authorized:false,
    realPaymentsEnabled:false,
    canPayout:false,
  });
}

const ORDER=Object.freeze({critical:0,high:1,medium:2,external:3});
export function buildPartnerReadinessMatrix(input=[]){
  const rows=(Array.isArray(input)?input:[])
    .map(rowFromServer).filter(Boolean)
    .sort((a,b)=>ORDER[a.attention]-ORDER[b.attention]||
      a.countryCode.localeCompare(b.countryCode)||a.name.localeCompare(b.name)||
      a.id.localeCompare(b.id));
  const countries=new Set(rows.map(r=>r.countryCode));
  return Object.freeze({
    candidates:rows.length,
    countries:countries.size,
    expiredCandidates:rows.filter(r=>r.expiredRequirements>0).length,
    missingDateCandidates:rows.filter(r=>r.missingCriticalDates>0).length,
    internallyReviewedCandidates:rows.filter(r=>r.pendingRequirements===0).length,
    records:Object.freeze(rows),
    // Aunque todos los requisitos internos estén revisados, no hay autorización externa.
    authorizedPartners:0,
    authorizedBranches:0,
    realPaymentsEnabled:false,
    canPayoutCash:false,
    status:'internal_planning_only',
  });
}
