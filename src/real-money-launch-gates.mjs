// Requisitos mínimos verificables para planificar un lanzamiento de dinero REAL.
// IMPORTANTE: ninguna respuesta de este módulo permite enviar fondos.
// La habilitación real SOLO podrá implementarse por una institución regulada
// en un backend separado, con autorización humana y dictamen jurídico.
export const REAL_MONEY_GATES=Object.freeze([
 'legal_entity','legal_review_origin','legal_review_destination',
 'money_transmission_coverage','regulated_funding_partner',
 'regulated_payout_partner','signed_partner_contracts',
 'customer_funds_safeguarding','double_entry_ledger_audited',
 'bank_reconciliation_tested','kyc_kyb_provider','aml_sanctions_program',
 'fraud_limits_incident_response','remittance_disclosures_refunds',
 'privacy_security_audit','production_secrets_mfa',
 'sandbox_end_to_end_passed','financial_operations_approval'
]);
const COUNTRY=/^[A-Z]{2}$/;
const CURRENCY=/^[A-Z]{3}$/;
export function assessRealMoneyLaunchReadiness(input={}){
 const corridor=input?.corridor??{};
 const validCorridor=COUNTRY.test(corridor.origin||'')&&COUNTRY.test(corridor.destination||'')&&
  corridor.origin!==corridor.destination&&CURRENCY.test(corridor.sourceCurrency||'')&&
  CURRENCY.test(corridor.destinationCurrency||'');
 // Validaciones administrativas sirven para PREPARACIÓN, nunca como permiso operativo.
 const proofs=input?.evidence??{};
 const missing=REAL_MONEY_GATES.filter(k=>proofs[k]?.verified!==true||
  typeof proofs[k]?.reference!=='string'||!proofs[k].reference.trim());
 return Object.freeze({
   validCorridor,requirementsCount:REAL_MONEY_GATES.length,
   verifiedEvidenceCount:REAL_MONEY_GATES.length-missing.length,
   missingRequirements:Object.freeze(missing),
   readiness:!validCorridor?'invalid_corridor':missing.length?'requirements_incomplete':'requires_independent_authorization',
   // Fail closed, incluso si el cliente introduce todos los campos 'verified'.
   operationalApproval:false,realPaymentsEnabled:false,
   canHoldCustomerFunds:false,canMoveMoney:false,
   canGenerateRedeemableCode:false,
 });
}
