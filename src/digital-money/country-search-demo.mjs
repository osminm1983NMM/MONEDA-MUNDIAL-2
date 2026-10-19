import {ALL_COUNTRY_CODES} from './international-demo-planner.mjs';
// Catálogo para interfaz, NO autoriza corredores ni valida prestaciones bancarias.
const priority={US:'Estados Unidos',HN:'Honduras',NI:'Nicaragua',SV:'El Salvador',CR:'Costa Rica',EC:'Ecuador',CO:'Colombia',MX:'México',PE:'Perú',AR:'Argentina',ES:'España',TR:'Turquía'};
export const countryOptionsDemo=Object.freeze(ALL_COUNTRY_CODES.map(code=>Object.freeze({
 code,name:priority[code]||code,
 label:(priority[code]||code)+' ('+code+')'
})));
export function searchCountryOptionsDemo(text,limit=20){
 const input=typeof text==='string'?text.trim().toLocaleLowerCase('es'):'';
 if(!Number.isInteger(limit)||limit<1||limit>249)return [];
 const normalized=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const key=normalized(input);
 if(!key)return countryOptionsDemo.filter(v=>Object.hasOwn(priority,v.code)).slice(0,limit);
 return countryOptionsDemo.filter(v=>normalized(v.label).includes(key)).slice(0,limit);
}
