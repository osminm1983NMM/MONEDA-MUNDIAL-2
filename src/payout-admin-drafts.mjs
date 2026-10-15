// Registro administrativo TEMPORAL de diseño, únicamente ejemplos ficticios.
// NO es un registro de bancos reales; no guarda documentos, licencias ni datos personales.
// El servidor regulado deberá gestionar autorización, roles y auditoría.
// Los valores se descartan al cerrar sesión o reiniciar la aplicación.
const COUNTRY = /^[A-Z]{2}$/;
const CURRENCY = /^[A-Z]{3}$/;
export const DEMO_PARTNER_TYPES = Object.freeze(['bank','remittance_operator','cash_agent_network']);

function safeLabel(value,max=60) {
  if(typeof value!=='string') return null;
  const label=value.trim().replace(/\s+/g,' ');
  if(label.length<2 || label.length>max || /[<>\n\r]/.test(label)) return null;
  return label;
}

export function makeDemoPartnerDraft({name,countryCode,type}={},id){
  const label=safeLabel(name);
  if(!label || !COUNTRY.test(countryCode||'') || !DEMO_PARTNER_TYPES.includes(type) ||
      typeof id!=='string' || !/^[a-zA-Z0-9-]{12,64}$/.test(id)) return null;
  return Object.freeze({
    id,countryCode,type,name:'SIMULADO · '+label,status:'draft',
    dueDiligenceStatus:'not_started',contractStatus:'not_signed',
    licenseVerificationStatus:'not_verified',partnerAuthorized:false,
    realPaymentsEnabled:false,canIssueRealReference:false,
  });
}

export function makeDemoBranchDraft({partnerId,city,currencyCode,hours}={},id,partners=[]){
  const partner=Array.isArray(partners) ? partners.find(p=>p?.id===partnerId&&p?.status==='draft') : null;
  const cityLabel=safeLabel(city,70), hoursLabel=safeLabel(hours,80);
  if(!partner || !cityLabel || !hoursLabel || !CURRENCY.test(currencyCode||'') ||
      typeof id!=='string'|| !/^[a-zA-Z0-9-]{12,64}$/.test(id)) return null;
  return Object.freeze({
    id,partnerId,countryCode:partner.countryCode,city:cityLabel,
    currencyCode,hours:hoursLabel,status:'draft',isFictional:true,
    branchVerified:false,realPaymentsEnabled:false,canPayoutCash:false,
  });
}

export function summarizeDemoPayoutAdmin(partners=[],branches=[]){
  const p=Array.isArray(partners)?partners:[],b=Array.isArray(branches)?branches:[];
  return Object.freeze({
    partnersInDraft:p.length,branchesInDraft:b.length,
    verifiedPartners:0,authorizedBranches:0,liveCorridors:0,livePaymentsEnabled:false,
  });
}

export function deleteDemoPartnerDraft(partners=[],branches=[],partnerId){
  return Object.freeze({
    partners:partners.filter(p=>p.id!==partnerId),
    branches:branches.filter(b=>b.partnerId!==partnerId),
  });
}
