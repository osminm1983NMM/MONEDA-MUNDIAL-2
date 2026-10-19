import {ALL_COUNTRY_CODES} from './international-demo-planner.mjs';
// Catálogo para interfaz, NO autoriza corredores ni valida prestaciones bancarias.
const priority={US:'Estados Unidos',HN:'Honduras',NI:'Nicaragua',SV:'El Salvador',CR:'Costa Rica',EC:'Ecuador',CO:'Colombia',MX:'México',PE:'Perú',AR:'Argentina',ES:'España',TR:'Turquía'};
// Internacionalización nativa opcional; sin red y con código ISO seguro de respaldo.
let regionNames=null;
try {
 if(typeof Intl!=='undefined'&&typeof Intl.DisplayNames==='function')
  regionNames=new Intl.DisplayNames(['es'],{type:'region'});
} catch { regionNames=null; }
const displayName=code=>{
 if(Object.prototype.hasOwnProperty.call(priority,code))return priority[code];
 try {
  const label=regionNames?.of(code);
  return typeof label==='string'&&label!==code?label:code;
 } catch { return code; }
};
export const countryOptionsDemo=Object.freeze(ALL_COUNTRY_CODES.map(code=>{
 const name=displayName(code);
 return Object.freeze({code,name,label:name+' ('+code+')'});
}));
export function searchCountryOptionsDemo(text,limit=20){
 const input=typeof text==='string'?text.trim().toLocaleLowerCase('es'):'';
 if(!Number.isInteger(limit)||limit<1||limit>249)return [];
 const normalized=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const key=normalized(input);
 if(!key)return countryOptionsDemo.filter(v=>Object.prototype.hasOwnProperty.call(priority,v.code)).slice(0,limit);
 return countryOptionsDemo.filter(v=>normalized(v.label).includes(key)).slice(0,limit);
}
