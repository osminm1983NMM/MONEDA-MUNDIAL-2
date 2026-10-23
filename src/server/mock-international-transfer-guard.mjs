// Moneda Mundial 2.0 — intención de remesa internacional, SOLO SIMULACIÓN.
// Identificadores sintéticos, sin cuentas reales, transferencias, KYC ni dinero.
// Barrera en memoria: nunca usar como control contra duplicados en producción.
import {randomUUID} from 'node:crypto';

const REQUEST=/^[A-Za-z0-9_-]{12,90}$/;
const ALIAS=/^SIM-([A-Z]{2})-[A-Z0-9]{3,12}$/;
const COUNTRY=/^[A-Z]{2}$/;
const PREVIEW_MS=120000;
const DUPLICATE_MS=10*60000;
const MAX_INTENTS=500;
const INPUT_KEYS=['amountCents','destination','recipientAlias','requestId','senderAlias'].sort().join('|');
const bad=(message)=>{throw new Error(message);};
const frozen=(value)=>Object.freeze(value);

function validateIntent(input) {
 if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).sort().join('|')!==INPUT_KEYS)
   bad('Intención de remesa DEMO inválida: sólo identificadores sintéticos');
 const {requestId,senderAlias,recipientAlias,destination,amountCents}=input;
 const sender=typeof senderAlias==='string'?ALIAS.exec(senderAlias):null;
 const recipient=typeof recipientAlias==='string'?ALIAS.exec(recipientAlias):null;
 if(typeof requestId!=='string'||!REQUEST.test(requestId)||
    !sender||!recipient||!COUNTRY.test(destination||'')||
    recipient[1]!==destination||sender[1]===destination||
    senderAlias===recipientAlias||
    !Number.isSafeInteger(amountCents)||amountCents<100||amountCents>10000000)
   bad('Remesa internacional DEMO: país, beneficiario, remitente o importe inválido');
 return frozen({requestId,senderAlias,recipientAlias,destination,amountCents});
}
function fingerprint(i) {
 return JSON.stringify([i.senderAlias,i.recipientAlias,i.destination,i.amountCents]);
}
function validatePreviewId(preflightId) {
 return typeof preflightId==='string'&&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(preflightId);
}

export function createMockInternationalTransferGuard({lifecycle,clock=()=>Date.now()}={}) {
 if(!lifecycle||lifecycle.mode!=='mock'||lifecycle.canMoveRealMoney!==false||
   typeof lifecycle.createMockOrder!=='function'||
   typeof lifecycle.inspectMockOrder!=='function'||typeof clock!=='function')
  bad('Sólo permite motor de remesas ficticias');
 const pendingByRequest=new Map(),submittedByRequest=new Map(),recent=[];
 const now=()=>{
  const n=clock();
  if(!Number.isSafeInteger(n)||n<0)bad('Reloj de DEMO inválido');
  return n;
 };
 function lastDuplicate(fp,t) {
  for(let j=recent.length-1;j>=0;j--) {
   const item=recent[j];
   if(item.fingerprint===fp&&t>=item.atMs&&t-item.atMs<=DUPLICATE_MS)
    return item;
  }
  return null;
 }
 function previewView(p) {
  return frozen({
   status:'preview_mock',preflightId:p.preflightId,requestId:p.intent.requestId,
   senderAlias:p.intent.senderAlias,recipientAlias:p.intent.recipientAlias,
   destination:p.intent.destination,amountCents:p.intent.amountCents,
   expiresAtMs:p.expiresAtMs,duplicateRiskDetected:p.duplicateOrderId!==null,
   priorMockOrderId:p.duplicateOrderId,
   requiresExplicitDistinctConfirmation:p.duplicateOrderId!==null,
   beneficiaryIdentityVerified:false,realMoneyEnabled:false,
   transferExecuted:false,canMoveRealMoney:false,
  });
 }
 function receiptView(s,alreadyProcessed=false) {
  return frozen({
   status:'created_mock',requestId:s.intent.requestId,
   preflightId:s.preflightId,orderId:s.orderId,
   senderAlias:s.intent.senderAlias,recipientAlias:s.intent.recipientAlias,
   destination:s.intent.destination,amountCents:s.intent.amountCents,
   distinctDuplicateAcknowledged:s.confirmedDistinct,
   alreadyProcessed,beneficiaryIdentityVerified:false,
   fundingRealConfirmed:false,payoutRealConfirmed:false,
   realMoneyEnabled:false,canMoveRealMoney:false,
  });
 }
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,bankConnected:false,
  verificationServiceConnected:false,persistentIdempotencyConnected:false,
  previewMockTransfer(input) {
   const intent=validateIntent(input),fp=fingerprint(intent),t=now();
   const done=submittedByRequest.get(intent.requestId);
   if(done) {
    if(done.fingerprint!==fp)bad('RequestId reutilizado con destinatario o importe distinto');
    return frozen({...receiptView(done,true),status:'already_submitted_mock'});
   }
   if(submittedByRequest.size>=MAX_INTENTS)bad('Capacidad de laboratorio agotada');
   const dup=lastDuplicate(fp,t);
   const prior=pendingByRequest.get(intent.requestId);
   if(prior&&prior.fingerprint!==fp)
    bad('RequestId reutilizado con intención diferente');
   if(prior&&prior.expiresAtMs>t&&prior.duplicateOrderId===(dup?.orderId??null))
    return previewView(prior);
   const quote=frozen({
    intent,fingerprint:fp,preflightId:randomUUID(),
    duplicateOrderId:dup?.orderId??null,expiresAtMs:t+PREVIEW_MS
   });
   pendingByRequest.set(intent.requestId,quote);
   return previewView(quote);
  },
  submitMockTransfer({requestId,preflightId,acknowledgeDistinctDuplicate=false}={}) {
   if(typeof requestId!=='string'||!REQUEST.test(requestId)||
     !validatePreviewId(preflightId)||typeof acknowledgeDistinctDuplicate!=='boolean')
    bad('Confirmación de remesa DEMO inválida');
   const done=submittedByRequest.get(requestId);
   if(done) {
    if(done.preflightId!==preflightId)bad('Previsualización no corresponde con la operación original');
    return receiptView(done,true);
   }
   const p=pendingByRequest.get(requestId);
   if(!p||p.preflightId!==preflightId)
    bad('Previsualización inexistente o reemplazada, volver a revisar');
   const t=now();
   if(t>=p.expiresAtMs) {
    pendingByRequest.delete(requestId);
    bad('Previsualización vencida: no se realizó ninguna remesa');
   }
   const dup=lastDuplicate(p.fingerprint,t);
   if((dup?.orderId??null)!==p.duplicateOrderId)
    bad('Existe una operación nueva desde la previsualización: volver a revisar');
   if(dup&&!acknowledgeDistinctDuplicate)
    bad('Posible transferencia duplicada: exige consentimiento para otra operación distinta');
   if(!dup&&acknowledgeDistinctDuplicate)
    bad('Consentimiento de duplicación no corresponde a esta previsualización');
   // La única escritura es una orden ficticia en el motor in-memory.
   const order=lifecycle.createMockOrder({
    requestId,destination:p.intent.destination,amountCents:p.intent.amountCents
   });
   if(!order||order.environment!=='mock_only'||order.realMoneyEnabled!==false||
      order.fundingRealConfirmed!==false||order.payoutRealConfirmed!==false||
      order.status!=='created_mock'||order.alreadyProcessed!==false||
      typeof order.orderId!=='string')
    bad('Motor de órdenes de DEMO produjo una respuesta no verificable');
   const committed=frozen({
    intent:p.intent,fingerprint:p.fingerprint,preflightId,
    orderId:order.orderId,confirmedDistinct:!!dup,
   });
   submittedByRequest.set(requestId,committed);
   recent.push(frozen({fingerprint:p.fingerprint,orderId:order.orderId,atMs:t}));
   pendingByRequest.delete(requestId);
   return receiptView(committed);
  },
  inspectMockTransfer(requestId) {
   if(typeof requestId!=='string'||!REQUEST.test(requestId))
    bad('Referencia DEMO inválida');
   const entry=submittedByRequest.get(requestId);
   return entry?receiptView(entry):null;
  },
 });
}
