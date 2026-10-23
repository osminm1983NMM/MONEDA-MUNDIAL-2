// MONEDA MUNDIAL 2.0 — enlace de beneficiario y retirada: SÓLO LABORATORIO.
// ÚNICAMENTE servidor Node en memoria. NO banco, KYC, retiro o saldo real.
// Registra alias sintético en la creación de la remesa ficticia para evitar
// elegir arbitrariamente otro beneficiario al emitir un código SAMPLE.
const PLAIN=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const exact=(o,ks)=>PLAIN(o)&&Object.keys(o).sort().join('|')===ks.slice().sort().join('|');
const REF=/^[A-Za-z0-9-]{12,90}$/;
const COUNTRY=/^[A-Z]{2}$/;
const ALIAS=/^SAMPLE-([A-Z]{2})-[A-Z0-9]{6,25}$/;
const CASE=/^SIM-([A-Z]{2})-[A-Z0-9]{8,30}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const frozen=o=>Object.freeze(o);
const fail=message=>{throw Error(message);};
const SUBMIT=['requestId','order','beneficiaryAlias'];
const ORDER=['origin','destination','sourceCurrency','amountCents','payoutMethod'];
const ISSUE=['demoTransferId','caseId','beneficiaryAlias'];

export function createMockBeneficiaryBoundPickup({providerPort,pickupBinding}={}){
 if(providerPort?.integration!=='port-contract-mock-v1'||
    providerPort?.bankProviderConnected!==false||
    providerPort?.realFundsEnabled!==false||
    typeof providerPort.submitDemoTransfer!=='function'||
    typeof providerPort.checkDemoStatus!=='function'||
    pickupBinding?.mode!=='mock_only'||
    pickupBinding?.realMoneyEnabled!==false||
    typeof pickupBinding.issueSyntheticPickup!=='function'||
    typeof pickupBinding.inspectSyntheticPickup!=='function')
   fail('Beneficiarios vinculados disponibles sólo en DEMO');

 // Estas tablas no sustituyen a una base persistente, control de acceso o KYC.
 const byRequest=new Map(),byTransfer=new Map();
 function validateSubmit(input){
  if(!exact(input,SUBMIT)||!exact(input.order,ORDER))
   fail('Sólo formulario sintético: prohibidos datos personales y bancarios');
  const {requestId,order,beneficiaryAlias}=input;
  if(typeof requestId!=='string'||!REF.test(requestId)||
     typeof beneficiaryAlias!=='string'||!ALIAS.test(beneficiaryAlias)||
     order.origin!=='US'||order.sourceCurrency!=='USD'||
     order.payoutMethod!=='cash_pickup'||
     !COUNTRY.test(order.destination||'')||order.destination==='US'||
     beneficiaryAlias.slice(7,9)!==order.destination||
     !Number.isSafeInteger(order.amountCents)||order.amountCents<100||
     order.amountCents>10000000)
   fail('Destinatario/país/importe de remesa ficticia inválido');
  return frozen({requestId,
   order:frozen({...order}),beneficiaryAlias});
 }
 const fingerprint=p=>JSON.stringify([p.order.origin,p.order.destination,
  p.order.sourceCurrency,p.order.amountCents,p.order.payoutMethod,p.beneficiaryAlias]);
 function safeReceipt(record,alreadyProcessed,stage){
  return frozen({
   demoTransferId:record.demoTransferId,
   destination:record.destination,amountCents:record.amountCents,
   beneficiaryAlias:record.beneficiaryAlias,stage,alreadyProcessed,
   syntheticRecipientBound:true,trueBeneficiaryIdentityVerified:false,
   userAuthenticated:false,bankFundingVerified:false,
   livePayoutAuthorized:false,canPay:false,realMoneyEnabled:false,
  });
 }
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,identityProviderConnected:false,
  persistentRecipientRegistryConnected:false,
  // El beneficiario se selecciona al crear la remesa DEMO.
  // No existe API para cambiarlo o registrar un beneficiario después.
  submitRecipientBoundMockTransfer(input={}){
   const intent=validateSubmit(input),key=fingerprint(intent);
   const prior=byRequest.get(intent.requestId);
   if(prior&&prior.fingerprint!==key)
    fail('No se puede reemplazar el beneficiario o importe de la misma remesa');
   // El port aplica además su idempotencia interna en la misma referencia.
   const submitted=providerPort.submitDemoTransfer({
    requestId:intent.requestId,order:intent.order,
   });
   const id=submitted?.demoTransferId;
   if(typeof id!=='string'||!UUID.test(id)||
      submitted?.realMoneyEnabled!==false||
      submitted?.funded!==false||submitted?.paid!==false||
      submitted?.alreadyProcessed!==(prior!==undefined))
    fail('Respuesta de remesa ficticia no verificable o no vinculada');
   if(prior&&prior.demoTransferId!==id)
    fail('Reintento de laboratorio cambió inesperadamente de transferencia');
   // Impedir adoptar una remesa creada por una llamada externa al port.
   if(!prior&&byTransfer.has(id))
    fail('Remesa ficticia ya vinculada');
   const status=providerPort.checkDemoStatus(id);
   if(!status||status.demoTransferId!==id||
      status.realMoneyEnabled!==false||
      status.bankProviderConnected!==false||
      status.noConfirmedFunding!==true||
      status.noConfirmedDisbursement!==true||
      status.destination!==intent.order.destination||
      status.payoutMethod!=='cash_pickup'||
      status.sourceCurrency!=='USD'||
      status.sourceAmountCents!==intent.order.amountCents)
    fail('Estado de remesa ficticia no coincide con su registro');
   if(!prior){
    const saved=frozen({
     fingerprint:key,requestId:intent.requestId,demoTransferId:id,
     beneficiaryAlias:intent.beneficiaryAlias,
     destination:intent.order.destination,amountCents:intent.order.amountCents,
    });
    byRequest.set(intent.requestId,saved);
    byTransfer.set(id,saved);
   }
   return safeReceipt(byRequest.get(intent.requestId),!!prior,status.stage);
  },
  // Sólo desde esta API vinculada se debe emitir el SAMPLE. Nunca canjeable.
  issueBoundSample(input={}){
   if(!exact(input,ISSUE))fail('No enviar identidad, documentos ni cuentas');
   const {demoTransferId,caseId,beneficiaryAlias}=input;
   if(typeof demoTransferId!=='string'||!UUID.test(demoTransferId)||
      typeof caseId!=='string'||!CASE.test(caseId)||
      typeof beneficiaryAlias!=='string'||!ALIAS.test(beneficiaryAlias))
    fail('Petición de muestra inválida');
   const record=byTransfer.get(demoTransferId);
   if(!record)fail('Remesa no registrada con beneficiario sintético');
   // Bloqueo de cambio de destinatario, aunque se conserve el mismo país.
   if(record.beneficiaryAlias!==beneficiaryAlias||
      record.destination!==caseId.slice(4,6))
    fail('Beneficiario o país no coincide con la remesa original');
   const response=pickupBinding.issueSyntheticPickup({demoTransferId,
    caseId,beneficiaryAlias});
   if(response?.realMoneyEnabled!==false||response?.canRedeemAtBank!==false||
      response?.proofOfPayment!==false)
    fail('Emisión SAMPLE no verificable');
   return frozen({...response,trueBeneficiaryIdentityVerified:false,
    syntheticRecipientBound:true,realMoneyEnabled:false,canPay:false});
  },
  inspectBoundSample({demoTransferId}={}){
   if(typeof demoTransferId!=='string'||!UUID.test(demoTransferId))
    fail('Identificador DEMO inválido');
   if(!byTransfer.has(demoTransferId))
    fail('Transferencia no vinculada');
   const result=pickupBinding.inspectSyntheticPickup({demoTransferId});
   if(!result)return null;
   return frozen({...result,syntheticRecipientBound:true,
    trueBeneficiaryIdentityVerified:false,realMoneyEnabled:false,canPay:false});
  },
 });
}
