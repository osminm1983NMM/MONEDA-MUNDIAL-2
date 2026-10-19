// Traducciones iniciales de la pantalla internacional (planificación solamente).
// No se guardan preferencias ni se cargan diccionarios de servidores externos.
export function normalizeInternationalDemoLanguage(locale){
 if(typeof locale!=='string')return 'es';
 const primary=locale.trim().split(/[-_]/)[0].toLowerCase();
 return primary==='en'?'en':'es'; // Español como respaldo para idiomas aún no traducidos.
}
export function detectInternationalDemoLanguage(){
 try{
  const loc=typeof Intl!=='undefined'&&Intl.DateTimeFormat
   ?Intl.DateTimeFormat().resolvedOptions().locale:null;
  if(typeof loc==='string'&&loc.trim())return normalizeInternationalDemoLanguage(loc);
 }catch{}
 try{
  if(typeof navigator!=='undefined'&&typeof navigator.language==='string')
   return normalizeInternationalDemoLanguage(navigator.language);
 }catch{}
 return 'es';
}
const englishRequirements=Object.freeze([
 'Licensed remittance provider at both ends',
 'Corridor regulatory review and approval',
 'Customer identity (KYC), AML and sanctions checks',
 'Beneficiary and payout-method verification',
 'Exchange rates, fees and limits confirmed by provider',
 'Reconciliation, refunds, disputes and audit trail',
]);
const englishMethodNotes=Object.freeze({
 bank_account:'Bank account ownership and local banking coverage',
 card:'Card payout eligibility and approved provider',
 cash_pickup:'Licensed agent network and secure collection code',
 wallet:'Wallet provider, recipient ownership and local regulations',
});
const englishChecks=Object.freeze({
 provider_licensed:'Licensed provider and enabled corridor',
 sender_kyc:'Sender KYC for the intended corridor',
 beneficiary_identity:'Beneficiary identity verified by provider',
 sanctions_aml:'Provider AML and sanctions screening',
 risk_fraud:'Fraud risk checks and approved limits',
 quote_disclosure:'Verified quote, fees, FX, delivery and consent',
 bank_account_ownership:'Bank ownership verified by provider',
 card_payout_eligibility:'Card payout eligibility confirmed',
 cash_pickup_eligibility:'Licensed agent, on-site identification and secure pickup code',
 wallet_ownership:'Receiver wallet ownership and eligibility',
});
const englishProviderChecks=Object.freeze({
 origin_authorization:'Authorization to originate transfers',
 destination_authorization:'Receiving partner and payout authorization',
 contract:'Commercial contract and legal responsibilities',
 corridor:'Confirmed corridor and payout currency',
 method:'Enabled payout method for the corridor',
 api:'Authenticated API and provider sandbox',
 webhooks:'Authenticated events and reconciliation',
 idempotency:'Safe retries, refunds and uncertain outcomes',
 risk:'KYC, AML, sanctions, fraud and privacy',
 commercial:'Binding quotes, fees, limits and SLAs',
 settlement:'Safeguarding, settlement and reserves',
 consumer:'Consumer rights, disputes and error handling',
});
export const INTERNATIONAL_DEMO_TEXT=Object.freeze({
 es:Object.freeze({
  title:'Transferencia internacional — planificación',
  notice:'SOLO DEMOSTRACIÓN. No envía fondos, no genera tasa de cambio real ni habilita país alguno.',
  favorites:'Destinos frecuentes (todos los códigos ISO siguen disponibles)',
  search:'Buscar cualquier destino por nombre o código',
  searchPlaceholder:'Ejemplo: Nicaragua, México, JP',
  origin:'País de origen (ISO, 2 letras)',destination:'País destino (ISO, 2 letras)',
  amount:'Cantidad de referencia en USD (solo para planificación)',
  methods:'Forma de entrega propuesta (no disponible)',
  invalid:'Comprueba ambos códigos de país (distintos) y el importe positivo con máximo dos decimales.',
  route:'Ruta solicitada',amountShown:'Importe de referencia',delivery:'Entrega propuesta',
  beneficiaryPending:'Verificación del beneficiario: pendiente.',
  disabled:'ESTADO: NO HABILITADA. No hay comisión, proveedor, tasa ni importe de entrega confirmados.',
  requirements:'Requisitos antes de cualquier activación',
  beneficiary:'Verificación del beneficiario (pendiente)',
  provider:'Revisión de futuro proveedor (sin conexión)',
  noProvider:'Ningún proveedor está integrado ni autorizado para esta ruta. No existe cotización ni entrega disponible.',
  privacy:'No introduzcas nombre, identificación, tarjeta ni cuenta bancaria aquí. La verificación real todavía no está disponible.',
  awaiting:'pendiente de proveedor autorizado',unverified:'no verificado',
  methodNames:{bank_account:'Depósito bancario',card:'Entrega a tarjeta',cash_pickup:'Retiro en efectivo',wallet:'Billetera compatible'},
 }),
 en:Object.freeze({
  title:'International transfer — planning only',
  notice:'DEMO ONLY. No funds are sent, no live exchange rate is provided, and no country is enabled.',
  favorites:'Frequent destinations (all ISO codes remain available)',
  search:'Search any destination by name or code',searchPlaceholder:'Example: Nicaragua, Mexico, JP',
  origin:'Origin country (2-letter ISO code)',destination:'Destination country (2-letter ISO code)',
  amount:'Reference amount in USD (planning only)',
  methods:'Proposed payout method (unavailable)',
  invalid:'Choose two different valid country codes and a positive amount with no more than two decimal places.',
  route:'Requested route',amountShown:'Reference amount',delivery:'Proposed payout',
  beneficiaryPending:'Beneficiary verification: pending.',
  disabled:'STATUS: NOT ENABLED. No confirmed fee, provider, exchange rate, or payout amount.',
  requirements:'Requirements before any activation',
  beneficiary:'Beneficiary verification (pending)',
  provider:'Future provider assessment (not connected)',
  noProvider:'No provider is connected or approved for this route. No live quote or payout is available.',
  privacy:'Do not enter names, IDs, card numbers, or bank account details. Live identity verification is not available.',
  awaiting:'awaiting authorized provider',unverified:'not verified',
  methodNames:{bank_account:'Bank deposit',card:'Card payout',cash_pickup:'Cash pickup',wallet:'Compatible wallet'},
 }),
});
export function internationalRequirementText(language,requirements,methodId,index){
 if(language!=='en')return requirements[index]||'';
 return index<englishRequirements.length?englishRequirements[index]:(englishMethodNotes[methodId]||'');
}
export function internationalCheckText(language,item){
 return language==='en'?(englishChecks[item.id]||item.label):item.label;
}
export function internationalProviderCheckText(language,item){
 return language==='en'?(englishProviderChecks[item.id]||item.label):item.label;
}
