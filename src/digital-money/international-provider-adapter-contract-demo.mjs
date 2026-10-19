// Solo prototipo. Ninguna cuenta de proveedor puede pasar a producción.
// Contrato del adaptador propuesto: respuestas de planificación sin PII, dinero
// ni credenciales. No accede a red ni inicia transacciones.
const PROVIDERS=Object.freeze(['nium','thunes','terrapay']);
export function internationalProviderDiscoveryDemo({providerCode,plan}={}){
 if(!PROVIDERS.includes(providerCode)||!plan||
    plan.mode!=='planning_only'||plan.realPaymentsEnabled!==false||
    plan.executionAvailable!==false||plan.corridorStatus!=='not_enabled'||
    plan.quoteAvailable!==false||plan.providerId!==null||
    typeof plan.originCode!=='string'||typeof plan.destinationCode!=='string')
   return null;
 return Object.freeze({
   mode:'documentation_research_only',providerCode,
   originCode:plan.originCode,destinationCode:plan.destinationCode,
   payoutMethod:plan.payoutMethod,
   providerConnected:false,credentialConfigured:false,
   coverageVerified:false,agreementSigned:false,
   licensingVerified:false,beneficiaryVerified:false,
   availablePayers:null,exchangeRate:null,feeCents:null,
   quoteId:null,canQuote:false,canExecute:false,realPaymentsEnabled:false
 });
}
export function internationalLiveTransferDisabled(){
 throw new Error('OPERACION_BLOQUEADA: no hay proveedor contratado, licencias ni pagos habilitados');
}
