// Motor de elegibilidad para diseño de red mundial de retiro de efectivo.
// Fallo cerrado: no habilita dinero real ni confía en estados del dispositivo.
// La autorización de producción deberá implementarse en backend regulado.
export const PARTNER_STATES = Object.freeze(['draft','review','approved','suspended','revoked']);
export const AGENT_STATES = Object.freeze(['draft','review','approved','suspended','revoked']);
const ISO2 = /^[A-Z]{2}$/;
const ISO3 = /^[A-Z]{3}$/;

export function validatePayoutAgentRecord(agent) {
  if (!agent || typeof agent !== 'object') return false;
  if (typeof agent.id !== 'string' || !agent.id.trim() ||
      typeof agent.partnerId !== 'string' || !agent.partnerId.trim() ||
      !ISO2.test(agent.countryCode) ||
      !Array.isArray(agent.currencies) || !agent.currencies.length ||
      !agent.currencies.every(c => typeof c === 'string' && ISO3.test(c)) ||
      !AGENT_STATES.includes(agent.status)) return false;
  return true;
}

export function evaluateCashPickupReadiness({
  originCountry, destinationCountry, currency,
  corridor, partner, agent, compliance,
} = {}) {
  const reasons = [];
  if (!ISO2.test(originCountry || '') || !ISO2.test(destinationCountry || ''))
    reasons.push('INVALID_COUNTRY');
  if (!ISO3.test(currency || '')) reasons.push('INVALID_CURRENCY');
  if (!corridor || corridor.originCountry !== originCountry ||
      corridor.destinationCountry !== destinationCountry ||
      corridor.currency !== currency || corridor.status !== 'approved')
    reasons.push('CORRIDOR_NOT_APPROVED');
  if (!partner || partner.status !== 'approved' ||
      partner.id !== agent?.partnerId || partner.verifiedContract !== true ||
      partner.licenseVerified !== true)
    reasons.push('PARTNER_NOT_VERIFIED');
  if (!validatePayoutAgentRecord(agent) ||
      agent.status !== 'approved' || agent.countryCode !== destinationCountry ||
      !agent.currencies.includes(currency))
    reasons.push('AGENT_NOT_APPROVED');
  if (!compliance || compliance.kycPassed !== true ||
      compliance.sanctionsPassed !== true || compliance.fundsConfirmed !== true ||
      compliance.payoutPermissionVerified !== true)
    reasons.push('COMPLIANCE_INCOMPLETE');
  // La red MWD actual no posee acuerdos ni licencias operativas.
  // Solo un servicio regulado del lado servidor podrá emitir autorizaciones reales;
  // el evaluador de diseño nunca devuelve realPaymentsEnabled=true.
  return Object.freeze({
    status: reasons.length === 0 ? 'requires_regulated_server_approval' : 'blocked',
    reasons: Object.freeze(reasons),
    realPaymentsEnabled: false,
    canDisburse: false,
    canGenerateRedeemableCode: false,
  });
}
