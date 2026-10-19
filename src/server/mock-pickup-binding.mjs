// Moneda Mundial — unión de dos laboratorios aislados (sin banco ni retiro real).
// El estado "completado" de una remesa MOCK significa SOLO que terminó
// su simulación, nunca que hubo financiación o entrega confirmada.
// Este archivo es de SERVIDOR Node, nunca para React Native ni producción.
const PLAIN=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const DEMO_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CASE=/^SIM-([A-Z]{2})-[A-Z0-9]{8,30}$/;
const ALIAS=/^SAMPLE-([A-Z]{2})-[A-Z0-9]{6,25}$/;
const noReal=Object.freeze({mode:'mock_only',realMoneyEnabled:false,
  bankFundingVerified:false,payoutConfirmed:false,
  beneficiaryIdentityVerified:false,canRedeemAtBank:false});
const fail=m=>{throw Error(m)};
const exact=(o,keys)=>PLAIN(o)&&Object.keys(o).sort().join('|')===keys.slice().sort().join('|');

export function createMockPickupBinding({providerPort,pickupVerifier}={}){
 if(providerPort?.integration!=='port-contract-mock-v1'||
    providerPort?.realFundsEnabled!==false||
    providerPort?.bankProviderConnected!==false||
    typeof providerPort.checkDemoStatus!=='function'||
    pickupVerifier?.mode!=='mock'||pickupVerifier?.realMoneyEnabled!==false||
    typeof pickupVerifier.createSample!=='function'||
    typeof pickupVerifier.inspectSample!=='function')
   fail('Vinculación disponible únicamente entre laboratorios ficticios');
 const issuedByTransfer=new Map();
 const transferByCase=new Map();
 function validateData(input){
  if(!exact(input,['demoTransferId','caseId','beneficiaryAlias']))
   fail('Petición de emisión ficticia inválida: no enviar identidad, documentos ni datos bancarios');
  const {demoTransferId,caseId,beneficiaryAlias}=input;
  if(typeof demoTransferId!=='string'||!DEMO_ID.test(demoTransferId)||
     typeof caseId!=='string'||!CASE.test(caseId)||
     typeof beneficiaryAlias!=='string'||!ALIAS.test(beneficiaryAlias)||
     caseId.slice(4,6)!==beneficiaryAlias.slice(7,9))
   fail('Referencias ficticias inválidas');
  return input;
 }
 function safeReceipt(link){
  return Object.freeze({...noReal,caseId:link.caseId,
    demoTransferId:link.demoTransferId,destination:link.destination,
    sampleCodeIssued:true,sampleCodeRetrievable:false,
    proofOfPayment:false});
 }
 return Object.freeze({
  mode:'mock_only',providerConnected:false,realMoneyEnabled:false,
  // El código SAMPLE se enseña UNA vez al harness (entorno educativo).
  // Repetir la misma petición JAMÁS devuelve el código secreto otra vez.
  issueSyntheticPickup(input={}){
   const {demoTransferId,caseId,beneficiaryAlias}=validateData(input);
   // Comprobar siempre estado más reciente del mismo mock de remesa.
   const status=providerPort.checkDemoStatus(demoTransferId);
   if(status?.realMoneyEnabled!==false||
     status?.bankProviderConnected!==false||
     status?.noConfirmedFunding!==true||
     status?.noConfirmedDisbursement!==true||
     status?.destination!==caseId.slice(4,6)||
     status?.payoutMethod!=='cash_pickup'||
     status?.stage!=='mock_provider_job_completed_unverified'||
     status?.sourceCurrency!=='USD'||
     !Number.isSafeInteger(status.sourceAmountCents)||
     status.sourceAmountCents<100||status.sourceAmountCents>10000000)
    fail('Orden ficticia no apta para emitir código SAMPLE');
   const existing=issuedByTransfer.get(demoTransferId);
   if(existing){
    if(existing.caseId!==caseId||existing.beneficiaryAlias!==beneficiaryAlias)
     fail('Una remesa ficticia no puede generar otro código');
    return Object.freeze({...safeReceipt(existing),alreadyIssued:true});
   }
   if(transferByCase.has(caseId))
    fail('Un caso de muestra ya está vinculado a otra remesa');
   const sample=pickupVerifier.createSample({caseId,
     beneficiaryAlias,country:status.destination,amountCents:status.sourceAmountCents});
   const link={demoTransferId,caseId,beneficiaryAlias,destination:status.destination};
   issuedByTransfer.set(demoTransferId,link);
   transferByCase.set(caseId,demoTransferId);
   return Object.freeze({...safeReceipt(link),alreadyIssued:false,
     sampleCode:sample.sampleCode,nonRedeemableWarning:
       'SOLO DEMOSTRACIÓN. Código sin valor; ningún banco ni agente puede entregar dinero.'});
  },
  inspectSyntheticPickup({demoTransferId}={}){
   if(typeof demoTransferId!=='string'||!DEMO_ID.test(demoTransferId))
    fail('Referencia de prueba inválida');
   const link=issuedByTransfer.get(demoTransferId);
   if(!link)return null;
   const status=pickupVerifier.inspectSample(link.caseId);
   return Object.freeze({...safeReceipt(link),codeStatus:status.status,
     failedAttempts:status.failedAttempts,expiresAt:status.expiresAt});
  },
 });
}
