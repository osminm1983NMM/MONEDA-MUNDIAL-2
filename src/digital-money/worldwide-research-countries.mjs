// ISO 3166-1 alpha-2 research catalogue (includes territories).
// Presence in this catalogue NEVER implies a bank, payout provider, licensed
// remittance corridor, exchange rate or usable Moneda Mundial wallet.
// No country is activated merely by selecting or searching it.
const ISO_CODES=Object.freeze(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));
const CODE_SET=new Set(ISO_CODES);
// Critical routes use offline translations even on Android builds where
// Intl.DisplayNames is unavailable. All 249 entries remain in ISO_CODES.
const FALLBACK=Object.freeze({
 HN:Object.freeze({es:'Honduras',en:'Honduras',pt:'Honduras'}),
 NI:Object.freeze({es:'Nicaragua',en:'Nicaragua',pt:'Nicarágua'}),
 EC:Object.freeze({es:'Ecuador',en:'Ecuador',pt:'Equador'}),
 CR:Object.freeze({es:'Costa Rica',en:'Costa Rica',pt:'Costa Rica'}),
 MX:Object.freeze({es:'México',en:'Mexico',pt:'México'}),
 ES:Object.freeze({es:'España',en:'Spain',pt:'Espanha'}),
 TR:Object.freeze({es:'Turquía',en:'Turkey',pt:'Turquia'}),
 US:Object.freeze({es:'Estados Unidos',en:'United States',pt:'Estados Unidos'}),
 DE:Object.freeze({es:'Alemania',en:'Germany',pt:'Alemanha'}),
 BR:Object.freeze({es:'Brasil',en:'Brazil',pt:'Brasil'}),
 FR:Object.freeze({es:'Francia',en:'France',pt:'França'}),
 JP:Object.freeze({es:'Japón',en:'Japan',pt:'Japão'}),
});
const FAVOURITES=Object.freeze(['HN','NI','EC','CR']);
const LANGUAGES=Object.freeze(['es','en','pt']);
const displayNameCaches=new Map(); // only public country names; never secrets.
function lang(v){return LANGUAGES.includes(v)?v:'es';}
function countryName(code,language='es'){
 const locale=lang(language);
 const direct=FALLBACK[code]?.[locale];
 if(direct)return direct;
 if(!displayNameCaches.has(locale)){
  let formatter=null;
  try {
   if(typeof Intl.DisplayNames==='function')
    formatter=new Intl.DisplayNames([locale],{type:'region'});
  }catch{ /* Older engines: codes remain searchable, not invented names. */ }
  displayNameCaches.set(locale,formatter);
 }
 try{
  const name=displayNameCaches.get(locale)?.of(code);
  if(typeof name==='string'&&name!==code)return name;
 }catch{ /* Never activate a country on a localization error. */ }
 return code;
}
const normalize=value=>value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const GLOBAL_RESEARCH_COUNTRY_COUNT=ISO_CODES.length;
export const WORLD_RESEARCH_REAL_PAYMENTS_ENABLED=false;
export function getWorldResearchCountry(code,language='es'){
 if(typeof code!=='string'||!CODE_SET.has(code))return null;
 return Object.freeze({code,name:countryName(code,language),
  currency:null,licensedRemittanceCorridor:false,
  bankProviderConfirmed:false,cashPickupAvailable:false,
  realPaymentsEnabled:false,
  status:'candidate_catalogue_only_no_verified_coverage'});
}
export function searchWorldResearchCountries(query='',limit=12,language='es'){
 if(typeof query!=='string'||!Number.isSafeInteger(limit)||
   limit<1||limit>25||query.length>80)return Object.freeze([]);
 const locale=lang(language),needle=normalize(query.trim());
 const names=code=>LANGUAGES.map(x=>normalize(countryName(code,x)));
 const rank=code=>{
  const iso=code.toLowerCase(),current=normalize(countryName(code,locale));
  const alternatives=names(code);
  if(iso===needle)return 0;
  if(current===needle)return 1;
  if(alternatives.includes(needle))return 2;
  if(iso.startsWith(needle))return 3;
  if(current.startsWith(needle))return 4;
  if(alternatives.some(n=>n.startsWith(needle)))return 5;
  return 6;
 };
 const matches=needle?
  ISO_CODES.filter(code=>code.toLowerCase().includes(needle)||
   names(code).some(n=>n.includes(needle)))
   .sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b)):
  [...FAVOURITES];
 return Object.freeze(matches.slice(0,limit).map(code=>getWorldResearchCountry(code,locale)));
}
