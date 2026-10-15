// Red de prueba con locales INVENTADOS. No hay afiliación con ningún banco.
export const DEMO_PAYOUT_AGENTS = Object.freeze([
 {id:'demo-ni-01',countryCode:'NI',city:'Managua',name:'Agente ficticio MWD Nicaragua',currencies:['NIO','USD'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-cr-01',countryCode:'CR',city:'San José',name:'Agente ficticio MWD Costa Rica',currencies:['CRC','USD'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-hn-01',countryCode:'HN',city:'Tegucigalpa',name:'Agente ficticio MWD Honduras',currencies:['HNL','USD'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-mx-01',countryCode:'MX',city:'Ciudad de México',name:'Agente ficticio MWD México',currencies:['MXN'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-co-01',countryCode:'CO',city:'Bogotá',name:'Agente ficticio MWD Colombia',currencies:['COP'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-ec-01',countryCode:'EC',city:'Quito',name:'Agente ficticio MWD Ecuador',currencies:['USD'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-us-01',countryCode:'US',city:'Nueva York',name:'Agente ficticio MWD Estados Unidos',currencies:['USD'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-es-01',countryCode:'ES',city:'Madrid',name:'Agente ficticio MWD España',currencies:['EUR'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
 {id:'demo-jp-01',countryCode:'JP',city:'Tokio',name:'Agente ficticio MWD Japón',currencies:['JPY'],hours:'L–V · 09:00–17:00 (ilustrativo)'},
].map(a => Object.freeze({...a,mode:'fictional_sample',partnerAuthorized:false,realPaymentsEnabled:false,redeemable:false,address:null,phone:null})));

export function searchDemoPayoutAgents(countryCode,query=''){
 if(typeof countryCode!=='string'||!/^[A-Z]{2}$/.test(countryCode))return [];
 const term=String(query||'').trim().toLocaleLowerCase();
 return DEMO_PAYOUT_AGENTS.filter(agent=>agent.countryCode===countryCode&&
  (!term||[agent.name,agent.city,...agent.currencies].some(value=>value.toLocaleLowerCase().includes(term))));
}
