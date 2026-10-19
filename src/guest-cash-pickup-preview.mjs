// VISTA INFORMATIVA PÚBLICA SIN CUENTA. No consulta servicios financieros,
// no genera referencias cobrables, no almacena datos y no enlaza con Supabase.
// Este contenido es el mismo para todas las personas y no acredita cobertura.
import {GLOBAL_RESEARCH_COUNTRY_COUNT,getWorldResearchCountry}
 from './digital-money/worldwide-research-countries.mjs';
export const GUEST_CASH_PICKUP_REAL_PAYMENTS_ENABLED=false;
// Atajos visibles; el buscador mundial permite investigar más destinos.
// Ninguno habilita una ruta de remesa, oficina o retiro de efectivo.
export const CASH_PICKUP_PUBLIC_DESTINATIONS=Object.freeze(['HN','NI','EC','CR']);
const STEP_KEYS=Object.freeze(['sender','identity','reference','payout','reconcile']);
const CONTENT=Object.freeze({
 es:Object.freeze({
  heading:'Cómo funcionaría el retiro de efectivo',
  warning:'SOLO DEMOSTRACIÓN · NO HAY DINERO NI CÓDIGOS COBRABLES',
  subtitle:'Ejemplo educativo para beneficiarios sin aplicación o teléfono. No se crea ningún retiro.',
  choose:'País de ejemplo (sin servicios activos)',
  coverage:'Catálogo mundial de 249 países y territorios para investigación. Elegir un destino NO significa que haya servicios, licencias o agentes autorizados.',
  route:'Estados Unidos → ',
  reference:'Código de retiro: NO EMITIDO',
  status:'Agentes conectados: 0 · Retiros reales habilitados: 0',
  steps:Object.freeze([
   Object.freeze({id:'sender',title:'1. Envío',detail:'El remitente tendría que financiar una transferencia mediante un proveedor autorizado. Aquí no se aceptan fondos.'}),
   Object.freeze({id:'identity',title:'2. Beneficiario',detail:'Un agente autorizado tendría que verificar la identidad según las leyes locales; esta pantalla no verifica personas.'}),
   Object.freeze({id:'reference',title:'3. Código protegido',detail:'Se necesitaría un código temporal y de un solo uso, emitido por un servidor autorizado. No hay código real en esta demostración.'}),
   Object.freeze({id:'payout',title:'4. Entrega',detail:'Solo el proveedor y agente autorizados podrían entregar efectivo. No existe red de cobro conectada.'}),
   Object.freeze({id:'reconcile',title:'5. Confirmación',detail:'El sistema real requeriría recibo, conciliación, reclamaciones y devoluciones conforme a ley.'}),
  ]),
  blocked:'Sin proveedor contratado, licencia/cobertura confirmada, KYC/AML y pruebas oficiales, el retiro permanece BLOQUEADO.',
  back:'Volver al recorrido de Moneda Mundial',
 }),
 en:Object.freeze({
  heading:'How cash pickup could work',
  warning:'DEMO ONLY · NO MONEY OR REDEEMABLE CODES',
  subtitle:'Educational example for recipients without an app or smartphone. No payout request is created.',
  choose:'Example country (no live services)',
  coverage:'Research catalog of 249 countries and territories. Selecting a destination does NOT mean any services, licenses or authorized agents are available.',
  route:'United States → ',
  reference:'Pickup code: NOT ISSUED',
  status:'Connected agents: 0 · Live cash payouts: 0',
  steps:Object.freeze([
   Object.freeze({id:'sender',title:'1. Send',detail:'The sender would have to fund a transfer through an authorized provider. No funds are accepted here.'}),
   Object.freeze({id:'identity',title:'2. Recipient',detail:'An authorized agent would need to verify identity as local law requires. This screen does not verify people.'}),
   Object.freeze({id:'reference',title:'3. Protected reference',detail:'An authorized server would need to issue a temporary single-use code. No real code exists in this demo.'}),
   Object.freeze({id:'payout',title:'4. Payout',detail:'Only authorized providers and agents could release cash. No payout network is connected.'}),
   Object.freeze({id:'reconcile',title:'5. Confirmation',detail:'A real system would need receipts, reconciliation, claims and refunds as required by law.'}),
  ]),
  blocked:'Without a contracted provider, confirmed legal coverage, KYC/AML and official testing, payouts remain BLOCKED.',
  back:'Back to the Moneda Mundial tour',
 }),
});
// Estados Unidos es origen de este ejemplo, no una ruta US→US.
// El catálogo global conserva US y los 249 códigos; solo se excluye
// como DESTINO extranjero desde Estados Unidos en esta vista.
export function getGuestCashPickupPreview({language='es',destination='HN'}={}){
 const l=language==='en'?'en':'es';
 const research=destination==='US'?null:getWorldResearchCountry(destination,l);
 if(!research)return null;
 const content=CONTENT[l];
 return Object.freeze({
  ...content,
  destination,countryName:research.name,
  routeLabel:content.route+research.name,
  steps:content.steps,stepCount:STEP_KEYS.length,
  researchCatalogueSize:GLOBAL_RESEARCH_COUNTRY_COUNT,
  routeAvailable:false,licensedRemittanceCorridor:false,
  requiresAccount:false,contactedSupabase:false,codeIssued:false,
  registeredPayoutAgents:0,confirmedProviders:0,
  customerIdentityVerified:false,transferCreated:false,
  realMoneyEnabled:false,canWithdraw:false,canIssueCode:false,
 });
}
