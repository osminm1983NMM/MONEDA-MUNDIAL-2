// ISO 3166-1 alpha-2 research catalogue (includes territories).
// Presence in this catalogue NEVER implies a bank, payout provider, licensed
// remittance corridor, exchange rate or usable Moneda Mundial wallet.
// No country is activated merely by selecting or searching it.
const ISO_CODES=Object.freeze(`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));
const CODE_SET=new Set(ISO_CODES);
const FALLBACK=Object.freeze({HN:'Honduras',NI:'Nicaragua',EC:'Ecuador',
 CR:'Costa Rica',MX:'México',ES:'España',TR:'Turquía',US:'Estados Unidos'});
const FAVOURITES=Object.freeze(['HN','NI','EC','CR']);
export const GLOBAL_RESEARCH_COUNTRY_COUNT=ISO_CODES.length;
export const WORLD_RESEARCH_REAL_PAYMENTS_ENABLED=false;
function countryName(code){
 if(Object.hasOwn(FALLBACK,code))return FALLBACK[code];
 try{
  if(typeof Intl.DisplayNames==='function'){
   const value=new Intl.DisplayNames(['es'],{type:'region'}).of(code);
   if(typeof value==='string'&&value!==code)return value;
  }
 }catch{ /* Older Android engines may lack some Intl APIs. */ }
 return code;
}
export function getWorldResearchCountry(code){
 if(typeof code!=='string'||!CODE_SET.has(code))return null;
 return Object.freeze({code,name:countryName(code),
  currency:null,licensedRemittanceCorridor:false,
  bankProviderConfirmed:false,cashPickupAvailable:false,
  realPaymentsEnabled:false,
  status:'candidate_catalogue_only_no_verified_coverage'});
}
export function searchWorldResearchCountries(query='',limit=12){
 if(typeof query!=='string'||!Number.isSafeInteger(limit)||
   limit<1||limit>25||query.length>80)return Object.freeze([]);
 const trim=query.trim().toLocaleLowerCase('es');
 const needle=trim.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const match=code=>{
  const c=getWorldResearchCountry(code);
  const name=c.name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return c.code.toLowerCase().includes(needle)||name.includes(needle);
 };
 const matches=trim?
  ISO_CODES.filter(match).sort((a,b)=>a.localeCompare(b)):
  [...FAVOURITES];
 return Object.freeze(matches.slice(0,limit).map(getWorldResearchCountry));
}
