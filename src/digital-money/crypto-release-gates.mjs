// Moneda Mundial 2.0 — planificación de dos futuros activos criptográficos.
// NO es un contrato, wallet, exchange, stablecoin, testnet desplegada ni backend de pagos.
// Los créditos MWD de Supabase/Expo son solo DEMO y no respaldan estos activos.
export const CRYPTO_ASSETS=Object.freeze({
 demo:Object.freeze({id:'mwd_demo_credits',kind:'non_redeemable_test_credit',
  isCrypto:false,tokenIssued:false,hasRealValue:false,convertibleToRealAssets:false}),
 coin:Object.freeze({id:'moneda_mundial_coin',kind:'variable_market_price_crypto_candidate',
  isCrypto:true,tokenIssued:false,priceUsd:null,maxSupply:null,chain:null}),
 digital:Object.freeze({id:'moneda_mundial_digital',kind:'stablecoin_concept',
  isCrypto:true,tokenIssued:false,issuerSelected:false,redeemable:false,
  reservesVerified:false,usdPegGuaranteed:false,chain:null}),
});
const REFERENCE=/^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,119}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const PHASES=Object.freeze({
 coin_testnet_design:Object.freeze([
  'coin_tokenomics_supply_governance_and_vesting',
  'token_legal_classification_and_jurisdiction_review',
  'testnet_network_and_contract_specification',
  'security_threat_model_and_key_management',
  'independent_contract_security_assessment',
 ]),
 coin_public_issuance:Object.freeze([
  'coin_tokenomics_supply_governance_and_vesting',
  'token_legal_classification_and_jurisdiction_review',
  'production_contract_independent_audit',
  'production_key_custody_and_incident_response',
  'distribution_tax_and_consumer_disclosures',
  'production_chain_monitoring_and_finality_policy',
 ]),
 digital_stablecoin:Object.freeze([
  'payment_stablecoin_legal_and_issuer_eligibility',
  'regulated_issuer_or_partner_contract',
  'reserve_safeguards_attestations_and_redemption_rights',
  'token_network_and_verified_contract_identity',
  'custody_transaction_monitoring_and_sanctions_policy',
  'bank_reconciliation_and_refund_rights',
 ]),
 coin_to_digital_exchange:Object.freeze([
  'coin_public_issuance_authorized',
  'digital_stablecoin_issuer_authorized',
  'authorized_exchange_and_liquidity_partner',
  'verifiable_market_quote_fx_fees_slippage_and_expiry',
  'kyc_aml_sanctions_and_licensed_exchange_scope',
  'idempotency_reversal_and_settlement_reconciliation',
 ]),
 digital_merchant_payments:Object.freeze([
  'digital_stablecoin_issuer_authorized',
  'merchant_consent_and_payment_disclosures',
  'onchain_finality_reconciliation_and_refunds',
  'authorized_custody_and_offramp_partner',
  'fraud_and_dispute_handling',
 ]),
 crypto_crossborder_remittance:Object.freeze([
  'origin_and_destination_money_transmission_scope',
  'kyc_aml_sanctions_consumer_remittance_rights',
  'licensed_funding_and_payout_partner_contracts',
  'fiat_offramp_and_beneficiary_identity_verification',
  'bank_onchain_reconciliation_and_error_handling',
 ]),
});

/* La fuente documental requerida depende del requisito. Es una etiqueta
 * auto-declarada, NO una verificación de autenticidad o licencia.
 * Un diseño interno nunca reemplaza un contrato, auditoría o dictamen externo.
 */
export const CRYPTO_EVIDENCE_SOURCES=Object.freeze(Object.fromEntries([
 ...["coin_tokenomics_supply_governance_and_vesting","testnet_network_and_contract_specification","security_threat_model_and_key_management"].map(key=>[key,Object.freeze(['internal_design'])]),
 ...["token_legal_classification_and_jurisdiction_review","distribution_tax_and_consumer_disclosures","payment_stablecoin_legal_and_issuer_eligibility","kyc_aml_sanctions_and_licensed_exchange_scope","merchant_consent_and_payment_disclosures","origin_and_destination_money_transmission_scope","kyc_aml_sanctions_consumer_remittance_rights"].map(key=>[key,Object.freeze(['legal_opinion'])]),
 ...["coin_public_issuance_authorized","digital_stablecoin_issuer_authorized"].map(key=>[key,Object.freeze(['regulator_record'])]),
 ...["regulated_issuer_or_partner_contract","authorized_exchange_and_liquidity_partner","authorized_custody_and_offramp_partner","licensed_funding_and_payout_partner_contracts"].map(key=>[key,Object.freeze(['signed_contract'])]),
 ...["independent_contract_security_assessment","production_contract_independent_audit","reserve_safeguards_attestations_and_redemption_rights","idempotency_reversal_and_settlement_reconciliation","onchain_finality_reconciliation_and_refunds","bank_onchain_reconciliation_and_error_handling"].map(key=>[key,Object.freeze(['independent_audit'])]),
 ...["production_key_custody_and_incident_response","production_chain_monitoring_and_finality_policy","token_network_and_verified_contract_identity","custody_transaction_monitoring_and_sanctions_policy","bank_reconciliation_and_refund_rights","verifiable_market_quote_fx_fees_slippage_and_expiry","fraud_and_dispute_handling","fiat_offramp_and_beneficiary_identity_verification"].map(key=>[key,Object.freeze(['provider_documentation'])]),
]));
// Validación de configuración: cada requisito debe tener una fuente explícita.
for(const list of Object.values(PHASES))
 for(const key of list)
  if(!Object.hasOwn(CRYPTO_EVIDENCE_SOURCES,key))
   throw new Error('Configuración de evidencias cripto incompleta');

export const CRYPTO_RELEASE_PHASES=PHASES;
function plain(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);}
function isoDate(v){
 if(typeof v!=='string'||!DATE.test(v))return false;
 const n=new Date(v+'T00:00:00Z');
 return !Number.isNaN(n.getTime())&&n.toISOString().slice(0,10)===v;
}
function recordCollected(v,phase,asOf,requirement) {
 if(!plain(v)||Object.keys(v).sort().join('|')!=='expiresOn|reference|reviewedOn|scope|source')return false;
 return v.scope===phase&&typeof v.reference==='string'&&REFERENCE.test(v.reference)&&
 CRYPTO_EVIDENCE_SOURCES[requirement]?.includes(v.source)===true&&
 isoDate(v.reviewedOn)&&isoDate(v.expiresOn)&&
 v.reviewedOn<=asOf&&v.expiresOn>=asOf&&v.reviewedOn<=v.expiresOn;
}
const OPERATIONAL_BLOCKS=Object.freeze({
 contractDeployAllowed:false,tokenIssued:false,stablecoinIssued:false,
 stablecoinRedeemable:false,customerFundsHeld:false,
 marketTradingEnabled:false,coinDigitalConversionEnabled:false,
 merchantPaymentsEnabled:false,cryptoRemittanceEnabled:false,
 custodyConnected:false,realFundsEnabled:false,
 verifiedPriceUsd:null,approvedCoinSupply:null,
});
export function assessCryptoReleasePhase({phase,asOf,evidence={}}={}) {
 const validPhase=typeof phase==='string'&&Object.hasOwn(PHASES,phase);
 const validDate=isoDate(asOf);
 const requirements=validPhase?PHASES[phase]:[];
 const validEvidence=plain(evidence)?evidence:{};
 const missing=validDate?requirements.filter(k=>!recordCollected(validEvidence[k],phase,asOf,k)):[...requirements];
 const complete=Boolean(validPhase&&validDate&&missing.length===0);
 return Object.freeze({
  phase:validPhase?phase:null,
  phaseValid:validPhase,dateValid:validDate,requirementCount:requirements.length,
  collectedCount:validPhase&&validDate?requirements.length-missing.length:0,
  missingEvidence:Object.freeze([...missing]),documentsCollected:complete,
  reviewStatus:!validPhase||!validDate?'invalid_input':
    complete?'independent_review_and_licensing_required':'documentation_pending',
  evidenceIsNotAuthorization:true,
  ...OPERATIONAL_BLOCKS,
 });
}
export function getCryptoProductSeparation() {
 return Object.freeze({
  demo:CRYPTO_ASSETS.demo,coin:CRYPTO_ASSETS.coin,digital:CRYPTO_ASSETS.digital,
  // Ningún saldo ficticio podrá ser canjeado por Coin, Digital o USD.
  demoToCoin:false,demoToDigital:false,demoToFiat:false,
  coinToDigitalAvailable:false,digitalToCoinAvailable:false,
  legalIssuerOrCustodianSelected:false,
  bridgeConnected:false,blockchainConnected:false,
  realFundsEnabled:false,
 });
}
