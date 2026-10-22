// MONEDA MUNDIAL 2.0 — conciliación de pagos y reembolsos: SOLO LABORATORIO.
// ESTE MÓDULO NO ES UN SERVICIO FINANCIERO NI ACREDITA FONDOS.
// Todos los estados, eventos, claves y saldos son ficticios, en memoria volátil.
// No se conecta con Supabase, bancos, tarjetas, exchanges, blockchain ni la app.
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const STATE = Object.freeze({
  created:'created_mock', funded:'funded_mock',
  payoutPending:'payout_pending_mock', payoutFailed:'payout_failed_mock',
  refundPending:'refund_pending_mock', refundFailed:'refund_failed_mock',
  paid:'paid_mock', refunded:'refunded_mock', cancelled:'cancelled_mock',
});
const PHASES = Object.freeze({
  funding:'funding_settled_mock', payout:'payout_settled_mock',
  payoutFailed:'payout_failed_mock', refund:'refund_settled_mock',
  refundFailed:'refund_failed_mock',
});
const ID=/^[A-Za-z0-9_-]{12,90}$/;
const COUNTRY=/^[A-Z]{2}$/;
const MAX_SKEW=300000;
const fail=(msg)=>{throw Error(msg);};
const own=(value,key)=>Object.hasOwn(value,key);
const sameKeys=(obj,expected)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===expected.slice().sort().join('|');
const hash=(v)=>createHash('sha256').update(v).digest('hex');
function signature(secret,timestamp,body){
 return createHmac('sha256',secret).update(String(timestamp)+'.'+body).digest('hex');
}
function signedEqual(expected,given){
 if(typeof given!=='string'||!/^[0-9a-f]{64}$/.test(given))return false;
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(given,'hex'));
}

export function createMockPaymentLifecycle({
 mode='mock',webhookSecret,clock=()=>Date.now(),countryCodes=['HN','NI'],
}={}){
 if(mode!=='mock')fail('FINANZAS REALES DESHABILITADAS');
 if(typeof webhookSecret!=='string'||webhookSecret.length<32)fail('Clave de TEST inválida');
 if(typeof clock!=='function'||!Array.isArray(countryCodes)||
   countryCodes.length===0||countryCodes.some(c=>!COUNTRY.test(c)||c==='US'))
   fail('Configuración de laboratorio inválida');
 const countries=new Set(countryCodes);
 const orders=new Map(),createdIds=new Map(),actionIds=new Map(),eventIds=new Map(),audit=[];
 const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0)fail('Reloj inválido');return n;};
 const checkId=(id)=>{if(typeof id!=='string'||!ID.test(id))fail('Identificador de TEST inválido');return id;};
 const get=(id)=>{const o=orders.get(id);if(!o)fail('Orden ficticia inexistente');return o;};
 const view=(o,alreadyProcessed=false)=>Object.freeze({
   orderId:o.id,destination:o.destination,currency:'USD',amountCents:o.amountCents,
   status:o.status,alreadyProcessed,environment:'mock_only',
   fundingRealConfirmed:false,payoutRealConfirmed:false,refundRealConfirmed:false,
   realMoneyEnabled:false,ledgerAutomaticallyPosted:false,
 });
 const log=(type,o)=>audit.push(Object.freeze({type,orderId:o.id,status:o.status}));
 const action=(kind,orderId,requestId,allowedState,newState)=>{
   checkId(requestId);
   const o=get(orderId);
   const previous=actionIds.get(requestId);
   if(previous){
     if(previous.kind!==kind||previous.orderId!==orderId)fail('Clave de acción reutilizada');
     // El reintento conserva el resultado ORIGINAL de esta acción,
     // aunque otro evento haya avanzado la orden después.
     return Object.freeze({...previous.result,alreadyProcessed:true});
   }
   if(o.status!==allowedState)fail('Transición ficticia prohibida');
   o.status=newState;
   const result=view(o);
   actionIds.set(requestId,{kind,orderId,result});
   log(kind,o);
   return result;
 };
 const suggestions=new Map(); // Sólo propuestas; NUNCA asientos registrados.
 function propose(o,phase){
   if(suggestions.has(o.id+':'+phase))return;
   const amount=String(o.amountCents);
   let lines;
   if(phase===PHASES.funding){
     lines=[
       {account:'BANK_CLEARING_USD',side:'debit',amount_minor:amount},
       {account:'CUSTOMER_PAYABLE_USD',side:'credit',amount_minor:amount},
     ];
   }else if(phase===PHASES.payout||phase===PHASES.refund){
     // SOLO USD en el laboratorio. Ninguna conversión USD/HNL se presume.
     lines=[
       {account:'CUSTOMER_PAYABLE_USD',side:'debit',amount_minor:amount},
       {account:'BANK_CLEARING_USD',side:'credit',amount_minor:amount},
     ];
   }else return;
   suggestions.set(o.id+':'+phase,Object.freeze({
     eventType:phase,reference:'DEMO_'+o.id.replaceAll('-','')+'_'+phase,
     currency:'USD',verifiedBankFunds:false,realPayment:false,
     recordedInLedger:false,providerReferenceAuthentic:false,
     canPostToLiveLedger:false,
     lines:Object.freeze(lines.map(l=>Object.freeze(l))),
   }));
 }
 return Object.freeze({
  mode:'mock',liveBankConnected:false,canMoveRealMoney:false,
  createMockOrder({requestId,destination,amountCents}={}){
   checkId(requestId);
   if(!countries.has(destination)||!Number.isSafeInteger(amountCents)||
      amountCents<100||amountCents>10000000)fail('Orden de ensayo inválida');
   const existed=createdIds.get(requestId);
   if(existed){
     const o=get(existed.orderId);
     if(o.destination!==destination||o.amountCents!==amountCents)
       fail('Clave de orden reutilizada con datos diferentes');
     return Object.freeze({...existed.result,alreadyProcessed:true});
   }
   const o={id:randomUUID(),destination,amountCents,status:STATE.created};
   orders.set(o.id,o);
   const result=view(o);
   createdIds.set(requestId,{orderId:o.id,result});
   log('order_created_mock',o);
   return result;
  },
  requestMockPayout({orderId,requestId}={}){
   return action('payout_requested_mock',orderId,requestId,STATE.funded,STATE.payoutPending);
  },
  // Sólo se puede cancelar una orden de prueba ANTES de cualquier supuesto
  // fondeo. Tras fondeo se requiere el flujo separado de reembolso ficticio.
  cancelMockBeforeFunding({orderId,requestId}={}){
   return action('order_cancelled_unfunded_mock',orderId,requestId,
     STATE.created,STATE.cancelled);
  },
  requestMockRefund({orderId,requestId}={}){
   const o=get(orderId);
   // Tras fallo de salida también se puede pedir devolución; una vez pagado
   // NO se hace reversión silenciosa al pagador.
   const before=o.status;
   if(before!==STATE.funded&&before!==STATE.payoutFailed){
     checkId(requestId);
     const previous=actionIds.get(requestId);
     if(previous?.kind==='refund_requested_mock'&&previous.orderId===orderId)
       return Object.freeze({...previous.result,alreadyProcessed:true});
     fail('No hay fondos ficticios disponibles para devolución');
   }
   return action('refund_requested_mock',orderId,requestId,before,STATE.refundPending);
  },
  // Reintento MANUAL de una devolución de laboratorio fallida.
  // Nunca se permite si la orden ya fue pagada, reembolsada o aún se procesa.
  // La misma requestId devuelve el resultado original; una clave diferente
  // representa una decisión nueva, registrada sólo en la auditoría ficticia.
  retryMockRefundAfterFailure({orderId,requestId}={}){
   return action('refund_retry_requested_mock',orderId,requestId,
     STATE.refundFailed,STATE.refundPending);
  },
  makeTestWebhook({eventId,orderId,phase}={}){
   checkId(eventId);
   const o=get(orderId);
   if(!Object.values(PHASES).includes(phase))fail('Evento de ensayo desconocido');
   const rawBody=JSON.stringify({
     eventId,orderId,phase,amountCents:o.amountCents,
     currency:'USD',destination:o.destination,environment:'mock_only'
   });
   const timestamp=now();
   return Object.freeze({rawBody,timestamp,signature:signature(webhookSecret,timestamp,rawBody)});
  },
  acceptTestWebhook({rawBody,timestamp,signature:received}={}){
   if(typeof rawBody!=='string'||Buffer.byteLength(rawBody,'utf8')>4096||
      !Number.isSafeInteger(timestamp)||Math.abs(now()-timestamp)>MAX_SKEW||
      !signedEqual(signature(webhookSecret,timestamp,rawBody),received))
      fail('Firma, tamaño o antigüedad de notificación de TEST inválidos');
   let e;
   try{e=JSON.parse(rawBody);}catch{fail('Notificación ficticia inválida');}
   if(!sameKeys(e,['eventId','orderId','phase','amountCents','currency','destination','environment'])||
     typeof e.eventId!=='string'||!ID.test(e.eventId)||
     !Object.values(PHASES).includes(e.phase)||e.environment!=='mock_only')
     fail('Esquema de evento de TEST inválido');
   const o=get(e.orderId);
   if(o.amountCents!==e.amountCents||o.destination!==e.destination||e.currency!=='USD')
     fail('Evento ficticio no coincide con la orden');
   const digest=hash(rawBody);
   const previous=eventIds.get(e.eventId);
   if(previous){
     if(previous.digest!==digest)fail('Identificador de evento reutilizado con otro contenido');
     // El reintento representa el evento ORIGINAL, no la etapa posterior
     // de la orden. No propone nuevos asientos ni cambia saldo alguno.
     return Object.freeze({accepted:true,duplicate:true,status:previous.acceptedStatus,
       realMoneyEnabled:false,ledgerAutomaticallyPosted:false});
   }
   const transitions={
     [PHASES.funding]:[STATE.created,STATE.funded],
     [PHASES.payout]:[STATE.payoutPending,STATE.paid],
     [PHASES.payoutFailed]:[STATE.payoutPending,STATE.payoutFailed],
     [PHASES.refund]:[STATE.refundPending,STATE.refunded],
     [PHASES.refundFailed]:[STATE.refundPending,STATE.refundFailed],
   };
   const [from,to]=transitions[e.phase];
   if(o.status!==from)fail('Transición de liquidación ficticia prohibida');
   o.status=to;
   eventIds.set(e.eventId,{digest,acceptedStatus:to});
   propose(o,e.phase);
   log(e.phase,o);
   return Object.freeze({accepted:true,duplicate:false,status:o.status,
     realMoneyEnabled:false,ledgerAutomaticallyPosted:false,
     validOnlyForMock:true});
  },
  inspectMockOrder(orderId){return view(get(orderId));},
  getAccountingProposals(orderId){
   const o=get(orderId);
   const phases=[PHASES.funding,PHASES.payout,PHASES.refund];
   return Object.freeze(phases.map(p=>suggestions.get(o.id+':'+p)).filter(Boolean));
  },
  getAuditLog(){return Object.freeze(audit.map(a=>Object.freeze({...a})));},
 });
}
