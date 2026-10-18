// Public, offline research catalogue. No session, Supabase, banks or FX feed.
// All ISO countries and territories are research entries, not enabled routes.
import {GLOBAL_RESEARCH_COUNTRY_COUNT,searchWorldResearchCountries} from './digital-money/worldwide-research-countries.mjs';
export const GUEST_WORLD_COUNTRIES_REAL_PAYMENTS_ENABLED=false;
const LABELS=Object.freeze({
 es:Object.freeze({
  title:'Explorar países del mundo',
  warning:'SOLO INVESTIGACIÓN · NINGÚN PAÍS ADMITE ENVÍOS REALES',
  subtitle:'Puedes buscar países o territorios sin iniciar sesión. Honduras es referencia de estudio; Nicaragua y todos los demás destinos continúan incluidos.',
  placeholder:'Buscar país o código ISO',
  listed:'Países y territorios en el catálogo',
  shown:'Resultados visibles',
  unavailable:'Sin proveedor autorizado, cotización real, envío ni retiro disponible.',
  empty:'No se encontró ese país o territorio.',
  back:'Volver al recorrido de Moneda Mundial',
 }),
 en:Object.freeze({
  title:'Explore countries worldwide',
  warning:'RESEARCH ONLY · NO COUNTRIES SUPPORT REAL TRANSFERS',
  subtitle:'Explore countries and territories without signing in. Honduras is an initial research route; Nicaragua and all other destinations remain listed.',
  placeholder:'Search country or ISO code',
  listed:'Countries and territories in catalogue',
  shown:'Visible results',
  unavailable:'No licensed provider, live quote, transfer or withdrawal is available.',
  empty:'No country or territory found.',
  back:'Back to the Moneda Mundial tour',
 }),
 pt:Object.freeze({
  title:'Explorar países do mundo',
  warning:'SOMENTE PESQUISA · NENHUM PAÍS ACEITA TRANSFERÊNCIAS REAIS',
  subtitle:'Consulte países e territórios sem iniciar sessão. Honduras é um exemplo de estudo; Nicarágua e todos os demais destinos permanecem no catálogo.',
  placeholder:'Buscar país ou código ISO',
  listed:'Países e territórios no catálogo',
  shown:'Resultados visíveis',
  unavailable:'Sem provedor autorizado, cotação real, transferência ou saque disponível.',
  empty:'Nenhum país ou território encontrado.',
  back:'Voltar à apresentação do Moneda Mundial',
 }),
});
export function getGuestWorldCountryPreview({query='',language='es'}={}){
 const locale=['es','en','pt'].includes(language)?language:'es';
 const safeQuery=typeof query==='string'&&query.length<=80?query:null;
 const results=safeQuery===null?[]:searchWorldResearchCountries(safeQuery,12,locale);
 if(results.some(x=>x.realPaymentsEnabled!==false||x.bankProviderConfirmed!==false||
  x.licensedRemittanceCorridor!==false||x.cashPickupAvailable!==false))
  throw Error('Catálogo público no puede anunciar operaciones financieras');
 return Object.freeze({
  ...LABELS[locale],language:locale,queryValid:safeQuery!==null,
  results:Object.freeze(results),totalCount:GLOBAL_RESEARCH_COUNTRY_COUNT,
  visibleCount:results.length,requiresLogin:false,
  liveCountries:0,providerConnected:false,customerBalanceKnown:false,
  canSend:false,canDeposit:false,canWithdraw:false,
  canBuyCrypto:false,realPaymentsEnabled:false,
  offlineOnly:true,
 });
}
