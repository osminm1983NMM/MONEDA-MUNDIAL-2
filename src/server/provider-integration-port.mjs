// Moneda Mundial: PORT / ADAPTER para futuras APIs reguladas.
// ESTE ADAPTADOR NUNCA HACE PETICIONES HTTP, NUNCA ACCEDE A BANCOS NI SALDOS.
// Sólo conecta el port de aplicación a un mock aislado en memoria de servidor.
// No representa los esquemas privados/reales de TerraPay, Thunes, Nium u otros.
import { createMockRegulatedProviderBridge } from './mock-regulated-provider-bridge.mjs';

const REF=/^[A-Za-z0-9-]{12,90}$/;
const ALLOWED_ORDER=['origin','destination','sourceCurrency','amountCents','payoutMethod'];
const ALLOWED_ENVELOPE=['order','requestId'];
const allowed=(value,fields)=>value!==null && typeof value==='object' &&
 !Array.isArray(value) && Object.keys(value).every(k=>fields.includes(k));
const fail=(message)=>{throw new Error(message)};
const frozen=(value)=>Object.freeze(value);
const stateToPhase=frozen({
 sandbox_submitted:'accepted_by_mock_provider_only',
 sandbox_pending:'processing_mock_provider_only',
 sandbox_completed:'mock_provider_job_completed_unverified',
 sandbox_failed:'mock_provider_job_failed_unverified',
});

export const PROVIDER_API_PORT_CONTRACT=frozen({
 version:'research-only-v1',
 methods:frozen(['getNonExecutableQuote','submitDemoTransfer',
  'receiveSignedDemoEvent','checkDemoStatus']),
 regulatedProviderSelected:false,
 realApiCredentialsInstalled:false,
 officialSandboxConnected:false,
 liveFundsEnabled:false,
 authenticFundingSettlement:false,
 authenticPayoutSettlement:false,
});

// Devuelve un port que exige datos sin identificadores personales, no acepta
// parámetros "url", token, mode=live o transport. Sólo demuestra el contrato
// con el mock local que ya tiene validación HMAC y de reintentos.
export function createMockProviderIntegrationPort(options={}){
 if(!allowed(options,['mode','webhookSecret','clock','countryCodes']))
    fail('No se permiten URLs, credenciales de proveedor ni transportes externos');
 const {mode='mock',webhookSecret,clock=()=>Date.now(),
   countryCodes=['HN','NI']}=options;
 if(mode!=='mock')fail('API bancaria real DESHABILITADA');
 const bridge=createMockRegulatedProviderBridge({mode,webhookSecret,clock,countryCodes});
 const created=new Map();
 function orderCheck(order){
  if(!allowed(order,ALLOWED_ORDER)||
     Object.keys(order).length!==ALLOWED_ORDER.length)
   fail('Sólo se aceptan datos DEMO mínimos, sin datos bancarios o personales');
 }
 return frozen({
  integration:'port-contract-mock-v1',
  bankProviderConnected:false,realFundsEnabled:false,
  getNonExecutableQuote(order){
   orderCheck(order);
   const q=bridge.quote(order);
   return frozen({...q,
    kind:'NOT_A_BANK_QUOTE',executable:false,
    feeCents:null,fxRate:null,recipientAmountCents:null,
    realFundsEnabled:false});
  },
  submitDemoTransfer(input={}){
   if(!allowed(input,ALLOWED_ENVELOPE)||
      Object.keys(input).length!==ALLOWED_ENVELOPE.length ||
      !REF.test(input.requestId||''))
     fail('Solicitud de demostración inválida');
   orderCheck(input.order);
   const result=bridge.submitSandboxTransfer(input);
   // Los recibos idempotentes pueden conservar la fase inicial; observar el
   // último estado del MOCK sin crear una segunda orden ni asumir pago.
   const latest=bridge.getSandboxTransfer(result.id);
   if(!latest||!Object.hasOwn(stateToPhase,latest.status))
     fail('Estado ficticio de reintento no verificable');
   created.set(result.id,frozen({origin:'US',
     destination:input.order.destination,payoutMethod:input.order.payoutMethod,
     sourceCurrency:'USD',sourceAmountCents:input.order.amountCents}));
   return frozen({
    demoTransferId:result.id,
    alreadyProcessed:result.alreadyProcessed,
    stage:stateToPhase[latest.status],
    funded:false,paid:false,refundable:false,
    realMoneyEnabled:false,providerContractSigned:false,
   });
  },
  receiveSignedDemoEvent(message={}){
   if(!allowed(message,['rawBody','timestamp','signature']) ||
      Object.keys(message).length!==3)
      fail('La notificación de laboratorio requiere forma exacta');
   // La firma del mock se comprueba aquí. Nunca aceptar "authenticated: true"
   // enviado por el cliente como sustituto de validación criptográfica.
   const event=bridge.verifyAndApplyWebhook(message);
   return frozen({
    verifiedByMockOnly:event.accepted===true,
    alreadyProcessed:event.alreadyProcessed,
    stage:event.status?stateToPhase[event.status]:null,
    fundsSettled:false,payoutSettled:false,
    journalPostingAllowed:false,
    realMoneyEnabled:false,
   });
  },
  checkDemoStatus(demoTransferId){
   const record=created.get(demoTransferId);
   if(!record)fail('Orden demo desconocida');
   const found=bridge.getSandboxTransfer(demoTransferId);
   if(!found)fail('Estado del mock no disponible');
   return frozen({demoTransferId,...record,
    stage:stateToPhase[found.status],
    noConfirmedFunding:true,noConfirmedDisbursement:true,
    journalPostingAllowed:false,canRefundRealMoney:false,
    bankProviderConnected:false,realMoneyEnabled:false});
  },
  // Este generador existe SOLAMENTE para ensayos unitarios CI.
  makeSyntheticEvent(input){
   if(!allowed(input,['id','transferId','status']))fail('Evento de prueba inválido');
   return bridge.makeMockWebhook(input);
  },
  sanitizedAudit:()=>bridge.getSanitizedAudit(),
 });
}
