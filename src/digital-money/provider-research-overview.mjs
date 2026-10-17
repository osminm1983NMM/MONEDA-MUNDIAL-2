// Investigación documentada, no datos recibidos de los proveedores.
// Ninguna fila implica contrato, ruta US-HN confirmada o dinero real.
import {assessProviderCorridorDiligence} from '../server/provider-corridor-diligence.mjs';
import {RESEARCH_DESTINATIONS} from './project-launch-status.mjs';
export const RESEARCH_PROVIDERS=Object.freeze([
 Object.freeze({id:'CANDIDATE-NIUM',name:'Nium',study:'Cuenta bancaria y tarjeta',methods:Object.freeze(['bank_account','card'])}),
 Object.freeze({id:'CANDIDATE-TERRAPAY',name:'TerraPay',study:'Abono bancario y validación',methods:Object.freeze(['bank_account'])}),
 Object.freeze({id:'CANDIDATE-THUNES',name:'Thunes',study:'Consultar retiro de efectivo presencial',methods:Object.freeze(['cash_pickup'])}),
]);
export const RESEARCH_PAYOUTS=Object.freeze({
 bank_account:'Cuenta bancaria',card:'Tarjeta compatible',cash_pickup:'Retiro de efectivo',
});
export function getProviderResearchOverview({destination='HN',method='bank_account',asOf='2026-10-17'}={}){
 if(!Object.hasOwn(RESEARCH_DESTINATIONS,destination)||!Object.hasOwn(RESEARCH_PAYOUTS,method))return null;
 const country=RESEARCH_DESTINATIONS[destination];
 const corridor={origin:'US',destination,sourceCurrency:'USD',destinationCurrency:country.currency,payoutMethod:method};
 const candidates=RESEARCH_PROVIDERS.map(provider=>{
  const checklist=assessProviderCorridorDiligence({corridor,candidateProviderId:provider.id,asOf});
  return Object.freeze({
   name:provider.name,providerId:provider.id,study:provider.study,
   candidateMethodInResearch:provider.methods.includes(method),
   documentationMissing:checklist.missingOrInvalidRequirements.length,
   documentationRequired:checklist.requirementsCount,
   confirmedRoute:false,providerContractSigned:false,sandboxAuthorized:false,
   payoutAgentVerified:false,canSend:false,realPaymentsEnabled:false,
  });
 });
 return Object.freeze({origin:'US',destination,country:country.country,method,
  sources:'research_only_not_provider_confirmation',
  candidates:Object.freeze(candidates),confirmedProviders:0,realTransfersEnabled:false,
  nextAction:'Solicitar confirmación formal escrita de cobertura, licencias y producto por corredor.',
 });
}
