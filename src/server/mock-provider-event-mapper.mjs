// Moneda Mundial — modelo de eventos de proveedor, SOLO contratos ficticios.
// NO corresponde al esquema real de TerraPay, Thunes, Nium o bancos.
// NO contiene credenciales ni ejecuta pagos, retiros, abonos o liquidaciones.
// Nunca transformar un "transfer completed" en "funds settled".
const STATUSES=Object.freeze({
 funding_pending:'funding_pending_mock',
 funding_settled:'funding_settled_mock',
 payout_pending:'payout_pending_mock',
 payout_settled:'payout_settled_mock',
 payout_failed:'payout_failed_mock',
 refund_pending:'refund_pending_mock',
 refund_settled:'refund_settled_mock',
});
const VALID=new Set(Object.values(STATUSES));
const SCHEMAS=Object.freeze({
 future_regulated_provider_alpha:Object.freeze({
  version:'research-v1',providerContractSigned:false,realApiConfigured:false,
  eventMap:STATUSES,
 }),
 future_regulated_provider_beta:Object.freeze({
  version:'research-v1',providerContractSigned:false,realApiConfigured:false,
  eventMap:STATUSES,
 }),
});
const EVENT_ID=/^[a-zA-Z0-9_-]{12,90}$/;
function fail(s){throw Error(s)}
export const RESEARCH_PROVIDER_SCHEMAS=SCHEMAS;
export function interpretMockProviderEvent({provider,payload,authenticated=false,mode='mock'}={}){
 if(mode!=='mock')fail('Conexión financiera real deshabilitada');
 // authenticated must be true from TEST HARNESS, not user-controlled input.
 if(authenticated!==true)fail('Falta comprobación ficticia de autenticidad del evento');
 if(!Object.hasOwn(SCHEMAS,provider))fail('Proveedor no integrado');
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   Object.keys(payload).sort().join(',')!=='amountCents,country,currency,eventId,orderId,status'||
   !EVENT_ID.test(payload.eventId)||!EVENT_ID.test(payload.orderId)||
   !Number.isSafeInteger(payload.amountCents)||payload.amountCents<100||
   payload.amountCents>10000000||payload.currency!=='USD'||
   !['HN','NI'].includes(payload.country)||!VALID.has(payload.status))
    fail('Evento de proveedor ficticio no válido');
 return Object.freeze({
  provider,providerSchema:'research-v1',eventId:payload.eventId,
  orderId:payload.orderId,destination:payload.country,
  currency:'USD',amountCents:payload.amountCents,
  normalizedStatus:payload.status,
  isFundingSettlement:payload.status===STATUSES.funding_settled,
  isPayoutSettlement:payload.status===STATUSES.payout_settled,
  isRefundSettlement:payload.status===STATUSES.refund_settled,
  realSignatureVerified:false,realProviderConnected:false,
  balanceCreditAllowed:false,realMoneyEnabled:false,
  mappingOnly:true,
 });
}
