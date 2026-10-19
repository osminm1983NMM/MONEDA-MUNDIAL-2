// Planificador de corredores internacionales. No es una cotización ni un pago.
// Los códigos son ISO 3166-1 alfa-2 (incluyen territorios). Nunca se excluyen
// Nicaragua ni otros países por no estar operativos hoy.
// SOLO DEMOSTRACIÓN: ninguna jurisdicción se activa automáticamente.
const ISO2=new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
export const ALL_COUNTRY_CODE_COUNT=ISO2.size;
export const DEMO_CORRIDOR_REQUIREMENTS=Object.freeze([
 'Proveedor de transferencias autorizado en ambos extremos',
 'Revisión regulatoria y habilitación del corredor',
 'Identificación de cliente (KYC) y controles AML/sanciones',
 'Verificación segura del beneficiario y método de entrega',
 'Tasas de cambio, comisiones y límites confirmados por proveedor',
 'Conciliación, reembolsos, disputas y registro de auditoría',
]);
export function validDemoCountryCode(input){
 return typeof input==='string'&&ISO2.has(input.trim().toUpperCase());
}
export function parseInternationalPlanCents(input){
 if(typeof input!=='string')return null;
 const v=input.trim().replace(',','.');
 if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(v))return null;
 const [whole,part='']=v.split('.');
 const cents=BigInt(whole)*100n+BigInt(part.padEnd(2,'0')||'0');
 if(cents<1n||cents>100000000n)return null;
 return Number(cents);
}
export function buildInternationalDemoPlan({originCode='US',destinationCode='HN',amountUSD='25.00'}={}){
 const origin=typeof originCode==='string'?originCode.trim().toUpperCase():'';
 const destination=typeof destinationCode==='string'?destinationCode.trim().toUpperCase():'';
 if(!ISO2.has(origin)||!ISO2.has(destination)||origin===destination)return null;
 const amountCents=parseInternationalPlanCents(amountUSD);
 if(amountCents===null)return null;
 return Object.freeze({
  mode:'planning_only',realPaymentsEnabled:false,quoteAvailable:false,
  originCode:origin,destinationCode:destination,sourceCurrency:'USD',
  amountCents,
  destinationCurrency:null,exchangeRate:null,feeCents:null,
  payoutAmount:null,providerId:null,executionAvailable:false,
  complianceStatus:'not_verified',corridorStatus:'not_enabled',
  requirements:[...DEMO_CORRIDOR_REQUIREMENTS],
 });
}
