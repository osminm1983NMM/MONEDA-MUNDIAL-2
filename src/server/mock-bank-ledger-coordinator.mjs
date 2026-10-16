// Adaptador conceptual de confirmación bancaria a contabilidad DEMO.
// Ninguna llamada de este módulo mueve fondos, valida cuentas reales ni
// confirma recepción de dinero. No recibe secretos ni eventos de clientes.
// Requiere un verificador de firma externo; el mock nunca es evidencia real.
import {createMockRegulatedProviderBridge} from './mock-regulated-provider-bridge.mjs';
const strictCode=/^[A-Z]{3}$/;
export function createMockBankLedgerCoordinator({webhookSecret,clock=()=>Date.now(),countryCodes=['HN','NI']}={}){
 const provider=createMockRegulatedProviderBridge({mode:'mock',webhookSecret,clock,countryCodes});
 const intents=new Map(),confirmed=new Set(),review=[];
 const fail=message=>{throw new Error(message)};
 return Object.freeze({
  environment:'mock_only',bankConnected:false,realFundsEnabled:false,
  prepareDemoIntent({requestId,order}={}){
   const t=provider.submitSandboxTransfer({requestId,order});
   const prior=intents.get(t.id);
   if(prior){
    if(prior.amountCents!==order.amountCents||prior.destination!==order.destination)fail('Intención inconsistente');
    return Object.freeze({...prior,alreadyProcessed:true});
   }
   const row={transferId:t.id,amountCents:order.amountCents,currency:'USD',
    destination:order.destination,status:'awaiting_mock_confirmation',
    bankFundsReceived:false,ledgerPostingAllowed:false};
   intents.set(t.id,row);return Object.freeze({...row,alreadyProcessed:false});
  },
  receiveDemoWebhook({rawBody,timestamp,signature}={}){
   const verified=provider.verifyAndApplyWebhook({rawBody,timestamp,signature});
   if(verified.alreadyProcessed)return Object.freeze({duplicate:true,ledgerPostingAllowed:false,realFundsReceived:false});
   const payload=JSON.parse(rawBody);const intent=intents.get(payload.transferId);
   if(!intent)fail('Transferencia ajena');
   if(verified.status==='sandbox_completed'){
     confirmed.add(intent.transferId);
     review.push(Object.freeze({type:'provider_sandbox_completed',transferId:intent.transferId,
      amountCents:intent.amountCents,currency:intent.currency,
      evidenceSource:'MOCK_ONLY',postToLiveLedger:false}));
   }
   return Object.freeze({status:verified.status,duplicate:false,
    mockTransferCompletion:confirmed.has(intent.transferId),
    ledgerPostingAllowed:false,realFundsReceived:false});
  },
  prepareDemoAccountingProposal(transferId){
   const i=intents.get(transferId);
   if(!i||!confirmed.has(transferId))fail('Falta evento completado en simulación');
   return Object.freeze({
     externalReference:'MOCK_'+transferId.replaceAll('-','').slice(0,32),
     amountMinor:String(i.amountCents),currency:i.currency,
     proposedEntries:Object.freeze([
      Object.freeze({account:'BANK_CLEARING_USD',side:'debit',amount_minor:String(i.amountCents)}),
      Object.freeze({account:'CUSTOMER_PAYABLE_USD',side:'credit',amount_minor:String(i.amountCents)}),
     ]),
     eventEvidence:'MOCK_ONLY',realFundsReceived:false,
     executableByClient:false,automaticPostingEnabled:false,
     canPostToRealLedger:false,
   });
  },
  audit(){return Object.freeze(review.map(x=>({...x})))},
  makeMockWebhook(opts){return provider.makeMockWebhook(opts)},
 });
}
