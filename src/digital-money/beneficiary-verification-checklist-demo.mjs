// Moneda Mundial 2.0: preparación de verificación de beneficiarios.
// NO ejecuta KYC/AML, no verifica identidad, no recopila datos privados y
// no habilita envíos. El resultado definitivo corresponde a un proveedor
// regulado y a controles seguros del servidor, nunca a la pantalla Android.
const UNIVERSAL = Object.freeze([
  Object.freeze({id:'provider_licensed',label:'Proveedor autorizado y corredor habilitado'}),
  Object.freeze({id:'sender_kyc',label:'Identificación del remitente según el corredor'}),
  Object.freeze({id:'beneficiary_identity',label:'Identidad del beneficiario contrastada por proveedor'}),
  Object.freeze({id:'sanctions_aml',label:'Controles AML y sanciones completados por el proveedor'}),
  Object.freeze({id:'risk_fraud',label:'Evaluación antifraude y límites autorizados'}),
  Object.freeze({id:'quote_disclosure',label:'Tarifa, tipo de cambio, entrega y consentimiento confirmados'}),
]);
const BY_METHOD = Object.freeze({
  bank_account:Object.freeze({id:'bank_account_ownership',label:'Titularidad y cuenta bancaria confirmadas por proveedor'}),
  card:Object.freeze({id:'card_payout_eligibility',label:'Elegibilidad y titularidad de tarjeta confirmadas por proveedor'}),
  cash_pickup:Object.freeze({id:'cash_pickup_eligibility',label:'Agente habilitado, identidad presencial y código seguro de retiro'}),
  wallet:Object.freeze({id:'wallet_ownership',label:'Titularidad y elegibilidad de billetera receptora'}),
});
export function buildBeneficiaryVerificationChecklistDemo(plan){
  if(!plan || plan.mode!=='planning_only' || plan.realPaymentsEnabled!==false ||
     plan.executionAvailable!==false || plan.corridorStatus!=='not_enabled' ||
     plan.providerId!==null || plan.beneficiaryDataCollected!==false ||
     !Object.hasOwn(BY_METHOD,plan.payoutMethod))return null;
  return Object.freeze({
    mode:'planning_only',
    beneficiaryVerified:false,
    providerVerificationAvailable:false,
    canTransfer:false,
    capturesPersonalData:false,
    checklist:Object.freeze([...UNIVERSAL,BY_METHOD[plan.payoutMethod]].map(item=>
      Object.freeze({...item,status:'requires_external_verification'})
    )),
  });
}
