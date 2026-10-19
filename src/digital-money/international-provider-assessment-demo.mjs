// Evaluación de FUTUROS proveedores: NO ES CONEXIÓN NI LICENCIA.
// Únicamente prepara preguntas de integración. No ejecuta solicitudes HTTP,
// nunca recibe claves, tokens, documentos ni datos de cuentas.
// Una marca "documented" del registro de socios NO acredita autorización.
const KINDS=new Set(['bank','remittance_company','agent_network','payment_institution']);
const STATUSES=new Set(['draft','under_review','needs_changes','documented','archived']);
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export const PROVIDER_DUE_DILIGENCE_DEMO=Object.freeze([
 Object.freeze({id:'origin_authorization',label:'Licencia o socio autorizado para originar transferencias en país emisor'}),
 Object.freeze({id:'destination_authorization',label:'Autorización regulatoria del receptor o agente pagador'}),
 Object.freeze({id:'contract',label:'Contrato comercial, roles y responsabilidades definidos'}),
 Object.freeze({id:'corridor',label:'Corredor y moneda de pago confirmados por escrito'}),
 Object.freeze({id:'method',label:'Método de entrega habilitado específicamente para el corredor'}),
 Object.freeze({id:'api',label:'API autenticada, ambiente sandbox, versiones y soporte'}),
 Object.freeze({id:'webhooks',label:'Autenticación de eventos y conciliación de estados'}),
 Object.freeze({id:'idempotency',label:'Idempotencia del envío, devoluciones y operaciones inciertas'}),
 Object.freeze({id:'risk',label:'KYC, AML, sanciones, antifraude y protección de datos'}),
 Object.freeze({id:'commercial',label:'Cotización vinculante, comisiones, límites, tiempos y SLA'}),
 Object.freeze({id:'settlement',label:'Fondos, titularidad, conciliación y reservas gestionadas legalmente'}),
 Object.freeze({id:'consumer',label:'Reclamaciones, errores, reversos y protección al consumidor'}),
]);

export function assessInternationalProviderCandidateDemo(plan,candidate=null){
 if(!plan||plan.mode!=='planning_only'||plan.realPaymentsEnabled!==false||
    plan.executionAvailable!==false||plan.quoteAvailable!==false||
    plan.corridorStatus!=='not_enabled'||plan.providerId!==null||
    typeof plan.originCode!=='string'||typeof plan.destinationCode!=='string')return null;
 if(candidate!==null&&(
   !candidate||typeof candidate!=='object'||Array.isArray(candidate)||
   typeof candidate.id!=='string'||!UUID.test(candidate.id)||
   !KINDS.has(candidate.partner_kind)||
   !STATUSES.has(candidate.review_status)||
   typeof candidate.country_code!=='string'||
   candidate.country_code!==plan.originCode&&candidate.country_code!==plan.destinationCode
 ))return null;
 // El registro del socio es solo una lista de candidatos, no un proveedor
 // operativo. Incluso un socio con documentos revisados continúa bloqueado.
 const review=candidate?.review_status??'not_selected';
 return Object.freeze({
   mode:'planning_only',
   candidateId:candidate?.id??null,
   candidateReviewStatus:review,
   documentationReviewed:review==='documented',
   legalAuthorizationVerified:false,
   providerConnected:false,
   webhookVerified:false,
   realPaymentsEnabled:false,
   canGetLiveQuote:false,
   canCreateTransfer:false,
   canCollectBeneficiaryData:false,
   missing:Object.freeze(PROVIDER_DUE_DILIGENCE_DEMO.map(v=>Object.freeze({
     id:v.id,label:v.label,status:'unverified'
   }))),
 });
}
