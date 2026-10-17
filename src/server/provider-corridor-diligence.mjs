// Moneda Mundial 2.0 — evaluación documental de proveedores por corredor.
// Exclusivamente planificación del backend: NO integra APIs, no verifica
// licencias por sí misma, NO usa PII, no custodia ni mueve dinero.
// Ninguna combinación de evidencia habilita pagos reales.
const TWO=/^[A-Z]{2}$/;
const THREE=/^[A-Z]{3}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const REF=/^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,119}$/;
const SOURCES=new Set(['regulator_record','signed_contract','provider_documentation','internal_policy']);
const COMMON=Object.freeze([
 'provider_legal_identity',
 'origin_licensing_model_and_state_scope',
 'destination_licensing_and_partner_scope',
 'signed_regulated_provider_agreement',
 'funds_safeguarding_and_settlement_responsibility',
 'kyc_aml_sanctions_responsibility_matrix',
 'consumer_disclosure_errors_cancellation_refunds',
 'verified_fee_fx_method_and_quote_validity',
 'reconciliation_and_double_entry_accounting',
 'sandbox_access_and_authorized_api_spec',
 'signed_webhook_replay_and_idempotency_controls',
 'data_protection_incident_and_dispute_process',
]);
const PER_METHOD=Object.freeze({
 bank_account:Object.freeze(['authorized_receiving_bank_rail','beneficiary_account_validation']),
 cash_pickup:Object.freeze([
  'licensed_cash_pickup_agent_network','in_person_beneficiary_identity_checks',
  'online_single_use_pickup_code_and_atomic_redemption'
 ]),
 card:Object.freeze(['authorized_card_payout_network','card_reversals_and_failure_handling']),
});
export const PROVIDER_CORRIDOR_EVIDENCE=COMMON;
export const PROVIDER_PAYOUT_EVIDENCE=PER_METHOD;

function isoDate(value) {
 if(typeof value!=='string'||!DATE.test(value))return false;
 const parsed=new Date(value+'T00:00:00.000Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function plainObject(value) {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
   (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function validRecord(record,scope,asOf) {
 // Una referencia opaca no equivale a una licencia verificada. Evitar
 // exposición de nombres, credenciales, tarjetas y documentos personales.
 if(!plainObject(record)||
    Object.keys(record).sort().join('|')!=='expiresOn|reference|reviewedOn|scope|source')return false;
 return record.scope===scope&&
  typeof record.reference==='string'&&REF.test(record.reference)&&
  SOURCES.has(record.source)&&isoDate(record.reviewedOn)&&
  isoDate(record.expiresOn)&&record.reviewedOn<=asOf&&
  record.expiresOn>=asOf&&record.expiresOn>=record.reviewedOn;
}
export function assessProviderCorridorDiligence({corridor,evidence={},asOf}={}) {
 const valid=plainObject(corridor)&&
  Object.keys(corridor).sort().join('|')==='destination|destinationCurrency|origin|payoutMethod|sourceCurrency'&&
  TWO.test(corridor.origin||'')&&TWO.test(corridor.destination||'')&&
  corridor.origin!==corridor.destination&&
  THREE.test(corridor.sourceCurrency||'')&&THREE.test(corridor.destinationCurrency||'')&&
  Object.hasOwn(PER_METHOD,corridor.payoutMethod);
 const dateOK=isoDate(asOf);
 const scope=valid?[
  corridor.origin,corridor.destination,corridor.sourceCurrency,
  corridor.destinationCurrency,corridor.payoutMethod,
 ].join(':'):null;
 const requirements=valid?[...COMMON,...PER_METHOD[corridor.payoutMethod]]:[];
 const goodEvidence=plainObject(evidence)?evidence:{};
 const missing=(!valid||!dateOK)?requirements:
   requirements.filter(key=>!validRecord(goodEvidence[key],scope,asOf));
 const recordsCompleted=valid&&dateOK?requirements.length-missing.length:0;
 const complete=valid&&dateOK&&missing.length===0;
 return Object.freeze({
  corridorValid:Boolean(valid),dateValid:dateOK,
  evidenceScope:scope,requirementsCount:requirements.length,
  documentsCurrentCount:recordsCompleted,
  missingOrInvalidRequirements:Object.freeze(missing),
  documentCollectionComplete:complete,
  status:!valid||!dateOK?'invalid_input':
    complete?'awaiting_independent_legal_and_provider_verification':'documents_incomplete',
  // Ni la documentación completa ni un campo auto-declarado habilitan fondos.
  destinationCoverageAuthorized:false,
  partnerContractVerified:false,
  legalLaunchApproval:false,officialSandboxConnected:false,
  payoutNetworkConnected:false,realPaymentsEnabled:false,
  canQuoteRealFx:false,canHoldCustomerFunds:false,canMoveMoney:false,
  canRedeemPickupCode:false,
 });
}
