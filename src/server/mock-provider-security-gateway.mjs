// MWD 2.0 — LABORATORIO: autenticación de notificaciones de terceros.
// Servidor Node aislado. NO HTTP, bancos, token de proveedor, base de datos
// ni transferencia real. Secretos inyectados sólo al crear este mock;
// nunca devolverlos ni colocarlos en logs, app móvil o repositorio.
// NINGUNA firma generada aquí puede confirmar un movimiento de fondos real.
import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {interpretMockProviderEvent,RESEARCH_PROVIDER_SCHEMAS} from './mock-provider-event-mapper.mjs';

const MAX_BODY=4096,MAX_SKEW_MS=300000;
const ids=Object.freeze(Object.keys(RESEARCH_PROVIDER_SCHEMAS));
const ID=/^[A-Za-z0-9_-]{12,90}$/;
const signatureFormat=/^[0-9a-f]{64}$/;
const transitions=Object.freeze({
 registered:['funding_pending_mock','funding_settled_mock'],
 funding_pending_mock:['funding_settled_mock'],
 funding_settled_mock:['payout_pending_mock','refund_pending_mock'],
 payout_pending_mock:['payout_settled_mock','payout_failed_mock'],
 payout_failed_mock:['refund_pending_mock'],
 refund_pending_mock:['refund_settled_mock'],
 payout_settled_mock:[],
 refund_settled_mock:[],
});
const fail=(message)=>{throw new Error(message)};
function strictShape(value,keys){
 return value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
}
function digest(value){return createHash('sha256').update(value).digest('hex');}
function sign(secret,provider,timestamp,rawBody){
 // Separación de dominio y proveedor: evita firma compartida entre laboratorios.
 return createHmac('sha256',secret)
  .update('MWD_MOCK_WEBHOOK_V1\n'+provider+'\n'+timestamp+'\n'+rawBody).digest('hex');
}
function constantTimeHex(left,right){
 if(!signatureFormat.test(left)||typeof right!=='string'||!signatureFormat.test(right))return false;
 return timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));
}
function validateSecret(value){
 if(typeof value!=='string'||value.length<32||value.length>200)return false;
 return true;
}

export function createMockProviderSecurityGateway({
 mode='mock',clock=()=>Date.now(),providerSecrets,
}={}){
 if(mode!=='mock')fail('PRODUCCIÓN BLOQUEADA: solo comprobaciones de laboratorio');
 if(typeof clock!=='function'||!providerSecrets||typeof providerSecrets!=='object'||
 Array.isArray(providerSecrets)||Object.keys(providerSecrets).length===0)
 fail('Configuración segura de investigación inválida');
 const entries=Object.entries(providerSecrets);
 const providers=new Map();
 for(const [provider,config] of entries){
  if(!ids.includes(provider)||!config||typeof config!=='object'||
   Array.isArray(config))fail('Proveedor de laboratorio no permitido');
  const fields=Object.keys(config);
  if(fields.some(f=>!['activeSecret','previousSecret','previousValidUntil'].includes(f))||
   !validateSecret(config.activeSecret))fail('Secreto de laboratorio inválido');
  if(Object.hasOwn(config,'previousSecret')){
   if(!validateSecret(config.previousSecret)||
    config.previousSecret===config.activeSecret||
    !Number.isSafeInteger(config.previousValidUntil)||
    config.previousValidUntil<0)fail('Rotación de clave ficticia inválida');
  }else if(Object.hasOwn(config,'previousValidUntil')){
   fail('Caducidad de clave anterior sin clave');
  }
  providers.set(provider,Object.freeze({
   activeSecret:config.activeSecret,
   previousSecret:config.previousSecret||null,
   previousValidUntil:config.previousValidUntil??null,
  }));
 }
 const getNow=()=>{
  const n=clock();
  if(!Number.isSafeInteger(n)||n<0)fail('Reloj de laboratorio no válido');
  return n;
 };
 const orders=new Map(),events=new Map(),audit=[];
 function orderKey(provider,orderId){return provider+':'+orderId}
 function response(mapped,status,duplicate){
  return Object.freeze({
   provider:mapped.provider,eventId:mapped.eventId,orderId:mapped.orderId,
   stage:status,duplicate,mockSignatureVerified:true,
   realSignatureVerified:false,realProviderConnected:false,
   bankFundsConfirmed:false,payoutConfirmed:false,
   manualLedgerPostingPermitted:false,liveMoneyMovementEnabled:false,
   realFundsEnabled:false,
  });
 }
 return Object.freeze({
  status:'security-research-only',registeredProviderCount:providers.size,
  providerApiConnected:false,canCallBankApi:false,
  registerMockOrder({provider,orderId,country,amountCents,currency}={}){
   if(!providers.has(provider)||typeof orderId!=='string'||!ID.test(orderId)||
      !['HN','NI'].includes(country)||currency!=='USD'||
      !Number.isSafeInteger(amountCents)||amountCents<100||amountCents>10000000)
      fail('Orden ficticia de proveedor inválida');
   const key=orderKey(provider,orderId),existing=orders.get(key);
   if(existing){
    if(existing.country!==country||existing.amountCents!==amountCents||
       existing.currency!==currency)fail('Clave de orden reutilizada con datos diferentes');
    return Object.freeze({registered:true,alreadyProcessed:true,
      realMoneyEnabled:false});
   }
   orders.set(key,{country,currency,amountCents,stage:'registered'});
   return Object.freeze({registered:true,alreadyProcessed:false,
    realMoneyEnabled:false});
  },
  makeSyntheticSignedEvent({provider,payload}={}){
   const cfg=providers.get(provider);
   if(!cfg)fail('Proveedor ficticio no configurado');
   // La firma de prueba es sólo un fixture CI, no una firma bancaria.
   const mapped=interpretMockProviderEvent({provider,payload,authenticated:true,mode:'mock'});
   if(!orders.has(orderKey(provider,mapped.orderId)))
    fail('Orden ficticia desconocida');
   const rawBody=JSON.stringify(payload),timestamp=getNow();
   return Object.freeze({provider,rawBody,timestamp,
     signature:sign(cfg.activeSecret,provider,timestamp,rawBody)});
  },
  receiveSyntheticWebhook(input={}){
   if(!strictShape(input,['provider','rawBody','timestamp','signature']))
    fail('Sobre de notificación inválido');
   const {provider,rawBody,timestamp,signature}=input;
   const cfg=providers.get(provider);
   if(!cfg)fail('Origen del laboratorio desconocido');
   const now=getNow();
   if(typeof rawBody!=='string'||Buffer.byteLength(rawBody,'utf8')>MAX_BODY||
     !Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>MAX_SKEW_MS)
      fail('Notificación de prueba vencida o demasiado grande');
   const current=constantTimeHex(sign(cfg.activeSecret,provider,timestamp,rawBody),signature);
   const older=Boolean(cfg.previousSecret&&now<=cfg.previousValidUntil&&
     constantTimeHex(sign(cfg.previousSecret,provider,timestamp,rawBody),signature));
   if(!current&&!older)fail('Firma ficticia inválida');
   let payload;
   try{payload=JSON.parse(rawBody)}catch{fail('Evento JSON inválido')}
   // Strict mapper handles PII and unknown keys, not merely HMAC.
   const mapped=interpretMockProviderEvent({provider,payload,authenticated:true,mode:'mock'});
   const order=orders.get(orderKey(provider,mapped.orderId));
   if(!order||order.country!==mapped.destination||
     order.currency!==mapped.currency||order.amountCents!==mapped.amountCents)
       fail('Notificación de tercero no corresponde a la orden de prueba');
   const eventKey=provider+':'+mapped.eventId,hash=digest(rawBody);
   const previous=events.get(eventKey);
   if(previous){
    if(previous.hash!==hash)fail('Identificador de evento reutilizado con otros datos');
    return response(mapped,order.stage,true);
   }
   if(!transitions[order.stage]?.includes(mapped.normalizedStatus))
    fail('Estado de proveedor fuera de orden o incompatible');
   order.stage=mapped.normalizedStatus;
   events.set(eventKey,{hash,orderId:mapped.orderId});
   audit.push(Object.freeze({provider,eventId:mapped.eventId,orderId:mapped.orderId,
     stage:order.stage,source:'mock_test_only'}));
   return response(mapped,order.stage,false);
  },
  inspectMockOrder({provider,orderId}={}){
   const order=orders.get(orderKey(provider,orderId));
   if(!order)fail('Orden de laboratorio no registrada');
   return Object.freeze({provider,orderId,stage:order.stage,
    amountCents:order.amountCents,country:order.country,
    realBankBalance:null,canIssueFunds:false,canPayout:false,canPostLedger:false});
  },
  safeAudit(){
   return Object.freeze(audit.map(row=>Object.freeze({...row})));
  },
  realBankAuthorized:false,realFundsEnabled:false,
 });
}
