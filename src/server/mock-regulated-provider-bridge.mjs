// Moneda Mundial 2.0 — ADAPTADOR DE CONTRATO en servidor.
// Este módulo NO se importa en React Native: sólo permite pruebas y no contacta bancos.
// No crea fondos, cuentas, comisiones reales o referencias de cobro.
import { createHmac, randomUUID, timingSafeEqual, createHash } from 'node:crypto';

const DEFAULT_DESIGN_COUNTRIES = Object.freeze(['HN', 'NI']); // ejemplos; el catálogo completo llega desde el servidor
const DEMO_STATUSES = new Set(['sandbox_submitted', 'sandbox_pending', 'sandbox_completed', 'sandbox_failed']);
const MONEY_RE = /^[A-Z]{3}$/;
const ORDER_KEYS = ['amountCents','destination','origin','payoutMethod','sourceCurrency'].join('|');
const CONFIG_KEYS = new Set(['mode','webhookSecret','clock','countryCodes']);
const plainRecord = value => value!==null && typeof value==='object' &&
 !Array.isArray(value) && (Object.getPrototypeOf(value)===Object.prototype ||
 Object.getPrototypeOf(value)===null);
const MODE_ERROR='DINERO REAL BLOQUEADO: no hay proveedor contratado ni aprobación regulatoria.';
const jsonClone = value => JSON.parse(JSON.stringify(value));
const auditSafe = (message) => new Error(message);

function requireMockOnly(mode) {
  if (mode !== 'mock') throw auditSafe(MODE_ERROR);
}
function validateOrder(order, countries) {
  // El mock nunca debe aceptar ni ignorar datos personales, cuentas o
  // controles "approved" suministrados por clientes. Forma EXACTA del contrato.
  if (!plainRecord(order) || Object.keys(order).sort().join('|')!==ORDER_KEYS)
    throw auditSafe('Orden de ensayo inválida: datos personales/bancarios prohibidos; solo campos públicos permitidos');
  if (order.origin !== 'US' || !countries.has(order.destination) ||
      !MONEY_RE.test(order.sourceCurrency ?? '') || order.sourceCurrency !== 'USD' ||
      !Number.isSafeInteger(order.amountCents) || order.amountCents < 100 || order.amountCents > 10000000 ||
      !['bank_account', 'cash_pickup'].includes(order.payoutMethod)) {
    throw auditSafe('Ruta o importe de ensayo inválido');
  }
  return {
    origin:'US', destination:order.destination,sourceCurrency:'USD',
    amountCents:order.amountCents,payoutMethod:order.payoutMethod,
  };
}
function digest(value) {return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function signature(secret,timestamp,rawBody) {
  return createHmac('sha256',secret).update(String(timestamp)+'.'+rawBody).digest('hex');
}
function constantTimeHex(a,b) {
  if(typeof a!=='string'||typeof b!=='string'||!/^[0-9a-f]{64}$/.test(a)||!/^[0-9a-f]{64}$/.test(b))
    return false;
  return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
export function createMockRegulatedProviderBridge(options={}) {
 if(!plainRecord(options) || Object.keys(options).some(key=>!CONFIG_KEYS.has(key)))
   throw auditSafe('Configuración de proveedor mock inválida');
 const {mode='mock', webhookSecret, clock=()=>Date.now(),
  countryCodes=DEFAULT_DESIGN_COUNTRIES}=options;
 requireMockOnly(mode);
 if(typeof webhookSecret!=='string' || webhookSecret.length<32)
   throw auditSafe('Se necesita una clave de ensayo secreta >=32 caracteres. Nunca incluirla en la app.');
 if(typeof clock!=='function')throw auditSafe('Reloj inválido');
 if(!Array.isArray(countryCodes) || countryCodes.some(code=>
     typeof code!=='string'||!(/^[A-Z]{2}$/.test(code)) || code==='US') ||
     new Set(countryCodes).size!==countryCodes.length)
   throw auditSafe('Catálogo de países de diseño inválido');
 const countries=new Set(countryCodes);
 const routes=Object.freeze([...countries].map(code=>'US:'+code).sort());
 const orders=new Map(); // sólo RAM de pruebas; nunca un ledger de producción
 const attempts=new Map();
 const events=new Map(); // evento de TEST ligado a su contenido exacto (anti-replay)
 const audit=[];
 const maybeLog = (type,reference) => audit.push(Object.freeze({type,reference})); // sin PII, sin secreto
 return Object.freeze({
  mode:'mock', providerConnected:false, moneyMovementEnabled:false,
  priorityDesignRoute:'US:HN',
  supportedDesignRoutes:routes, // SOLO países suministrados para simulación, NO rutas habilitadas
  quote(order) {
   const normalized=validateOrder(order,countries);
   return Object.freeze({
     route:'US:'+normalized.destination,amountCents:normalized.amountCents,sourceCurrency:'USD',
     payoutMethod:normalized.payoutMethod,
     feeCents:null,fxRate:null,recipientAmountCents:null,
     quoteBinding:'mock-only',quoteValidForRealTransfer:false,
     redeemable:false,moneyMovementEnabled:false,
   });
  },
  submitSandboxTransfer(input={}) {
   // Fallar cerrado: no aceptar ni ignorar PII, token, URL o bandera de pago "live".
   if(!plainRecord(input) || Object.keys(input).sort().join('|')!=='order|requestId')
     throw auditSafe('Solicitud de demostración inválida: solo orden e identificador');
   const {requestId,order}=input;
   if(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{12,90}$/.test(requestId))
     throw auditSafe('Identificador de reintento inválido');
   const normalized=validateOrder(order,countries),hash=digest(normalized);
   const existing=attempts.get(requestId);
   if(existing) {
     if(existing.hash!==hash)throw auditSafe('Idempotency key reutilizada con datos diferentes');
     // La referencia idempotente NO crea otra remesa; su estado consultado
     // se alinea con el último evento MOCK aceptado (nunca equivale a pago).
     const current=orders.get(existing.result.id);
     if(!current)throw auditSafe('Orden de ensayo inconsistente');
     return Object.freeze({...jsonClone(existing.result),
       status:current.status,alreadyProcessed:true});
   }
   const id=randomUUID(), result={
     id,requestId,status:'sandbox_submitted',source:'mock_memory_only',
     fundingConfirmed:false,recipientPaid:false,redeemable:false,
     realPaymentsEnabled:false,providerConnected:false,
   };
   orders.set(id,{...result,...normalized});
   attempts.set(requestId,{hash,result});
   maybeLog('mock_transfer_created',id);
   return Object.freeze(jsonClone({...result,alreadyProcessed:false}));
  },
  verifyAndApplyWebhook(message={}) {
   // La firma solo protege los bytes aceptados; no aceptar parámetros extra.
   if(!plainRecord(message) || Object.keys(message).sort().join('|')!=='rawBody|signature|timestamp')
     throw auditSafe('Notificación de ensayo inválida: campos inesperados');
   const {rawBody,timestamp,signature:incomingSignature}=message;
   // Falla cerrada ante relojes incompletos, saltos inválidos o edades >5 min.
   const current=clock();
   if(typeof rawBody!=='string'||Buffer.byteLength(rawBody,'utf8')>8192||
      !Number.isSafeInteger(timestamp)||timestamp<0 ||
      !Number.isSafeInteger(current)||current<0 ||
      Math.abs(current-timestamp)>5*60*1000)
     throw auditSafe('Notificación de ensayo inválida o vencida');
   if(!constantTimeHex(signature(webhookSecret,timestamp,rawBody),incomingSignature))
     throw auditSafe('Firma de notificación inválida');
   let event;
   try {event=JSON.parse(rawBody)} catch {throw auditSafe('JSON inválido');}
   if(!event||typeof event!=='object'||Array.isArray(event)||
      Object.keys(event).sort().join('|')!==['id','status','transferId'].sort().join('|')||
      typeof event.id!=='string'||!/^[a-zA-Z0-9-]{12,90}$/.test(event.id)||
      typeof event.transferId!=='string'||!DEMO_STATUSES.has(event.status))
     throw auditSafe('Esquema del evento inválido');
   const eventFingerprint=createHash('sha256').update(rawBody).digest('hex');
   const previous=events.get(event.id);
   if(previous){
     if(previous.fingerprint!==eventFingerprint)
       throw auditSafe('Identificador de evento reutilizado con otro contenido');
     // La repetición representa el evento aceptado originalmente, NO
     // el estado posterior de la orden. Evita reportar etapa vacía.
     return Object.freeze({alreadyProcessed:true,accepted:true,
       status:previous.acceptedStatus,moneyPaid:false,realPaymentsEnabled:false});
   }
   const stored=orders.get(event.transferId);
   if(!stored)throw auditSafe('Orden de simulación inexistente');
   const allowed={
     sandbox_submitted:['sandbox_pending','sandbox_failed'],
     sandbox_pending:['sandbox_completed','sandbox_failed'],
     sandbox_completed:[],sandbox_failed:[],
   };
   if(!allowed[stored.status]?.includes(event.status))
     throw auditSafe('Transición de estado de ensayo inválida');
   stored.status=event.status;
   events.set(event.id,Object.freeze({fingerprint:eventFingerprint,acceptedStatus:event.status}));
   maybeLog('mock_webhook_accepted',event.transferId);
   return Object.freeze({accepted:true,alreadyProcessed:false,status:stored.status,
     moneyPaid:false,realPaymentsEnabled:false});
  },
  // Sólo para CI/local: genera una notificación HMAC falsa.
  makeMockWebhook({id=randomUUID(),transferId,status}={}) {
    const rawBody=JSON.stringify({id,transferId,status});
    const timestamp=clock();
    if(!Number.isSafeInteger(timestamp)||timestamp<0)
      throw auditSafe('Reloj de ensayo inválido');
    return Object.freeze({rawBody,timestamp,signature:signature(webhookSecret,timestamp,rawBody)});
  },
  getSandboxTransfer(id) {
    const row=orders.get(id);
    if(!row)return null;
    return Object.freeze({id,status:row.status,payoutMethod:row.payoutMethod,
     fundingConfirmed:false,recipientPaid:false,realPaymentsEnabled:false,
     redeemable:false,providerConnected:false});
  },
  getSanitizedAudit(){return Object.freeze(audit.map(e=>({...e})));},
 });
}
