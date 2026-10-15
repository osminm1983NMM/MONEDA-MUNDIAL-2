// Red mundial prevista: solo evaluación local, nunca disponibilidad de pago real.
const REQUIREMENTS=Object.freeze(['partner_due_diligence','partner_contract','origin_authorization','destination_authorization','corridor_compliance','branch_verified','branch_operational','currency_supported','funding_and_settlement','aml_kyc_sanctions_controls']);
export const EMPTY_PAYOUT_NETWORK=Object.freeze({partners:Object.freeze([]),branches:Object.freeze([]),corridors:Object.freeze([])});
export function summarizeCashPickupNetwork(catalog,registry=EMPTY_PAYOUT_NETWORK){
 const countries=new Set((Array.isArray(catalog)?catalog:[]).map(c=>c?.code).filter(c=>typeof c==='string'&&/^[A-Z]{2}$/.test(c)));
 return Object.freeze({designDestinations:countries.size,partnerDrafts:Array.isArray(registry?.partners)?registry.partners.length:0,branchDrafts:Array.isArray(registry?.branches)?registry.branches.length:0,corridorDrafts:Array.isArray(registry?.corridors)?registry.corridors.length:0,liveCountries:0,livePartners:0,realPaymentsEnabled:false});
}
export function assessCashPickupReadiness({sourceCountry,destinationCountry,payoutCurrency,partner,branch,corridor}={}){
 const linked=Boolean(partner?.id&&partner.id===branch?.partnerId&&partner.id===corridor?.partnerId);
 const route=Boolean(/^[A-Z]{2}$/.test(sourceCountry||'')&&/^[A-Z]{2}$/.test(destinationCountry||'')&&sourceCountry!==destinationCountry&&/^[A-Z]{3}$/.test(payoutCurrency||'')&&corridor?.sourceCountry===sourceCountry&&corridor?.destinationCountry===destinationCountry&&corridor?.payoutCurrency===payoutCurrency&&branch?.country===destinationCountry);
 const checks={partner_due_diligence:linked&&partner?.dueDiligenceStatus==='verified',partner_contract:linked&&partner?.contractStatus==='signed',origin_authorization:linked&&partner?.originAuthorizationStatus==='verified',destination_authorization:linked&&partner?.destinationAuthorizationStatus==='verified',corridor_compliance:route&&corridor?.complianceStatus==='verified',branch_verified:linked&&route&&branch?.verificationStatus==='verified',branch_operational:route&&branch?.operationalStatus==='ready',currency_supported:route&&Array.isArray(branch?.supportedCurrencies)&&branch.supportedCurrencies.includes(payoutCurrency),funding_and_settlement:linked&&corridor?.settlementStatus==='verified',aml_kyc_sanctions_controls:linked&&corridor?.financialCrimeControlsStatus==='verified'};
 const missingRequirements=REQUIREMENTS.filter(k=>!checks[k]);
 return Object.freeze({status:missingRequirements.length?'not_ready':'candidate_for_external_review',missingRequirements,checkedRequirements:REQUIREMENTS.length,realPaymentsEnabled:false,canIssueRealReference:false,canPayoutCash:false});
}
export const CASH_PICKUP_NETWORK_REQUIREMENTS=REQUIREMENTS;
