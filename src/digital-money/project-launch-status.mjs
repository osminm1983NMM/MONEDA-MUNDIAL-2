// Resumen visible de requisitos: jamás conecta servicios ni autoriza operaciones.
// Todo es un inventario local estático; no es evidencia de licencias, contratos,
// fondos depositados o disponibilidad bancaria por país.
import {buildLaunchReadinessReport} from '../launch-readiness.mjs';
import {assessRealMoneyLaunchReadiness} from '../real-money-launch-gates.mjs';
import {assessCryptoReleasePhase} from './crypto-release-gates.mjs';

export const RESEARCH_DESTINATIONS=Object.freeze({
 HN:Object.freeze({country:'Honduras',currency:'HNL'}),
 NI:Object.freeze({country:'Nicaragua',currency:'NIO'}),
 EC:Object.freeze({country:'Ecuador',currency:'USD'}),
 CR:Object.freeze({country:'Costa Rica',currency:'CRC'}),
});

const CRYPTO_PHASES=Object.freeze([
 Object.freeze({id:'coin_public_issuance',label:'Moneda Mundial Coin'}),
 Object.freeze({id:'digital_stablecoin',label:'Moneda Mundial Digital'}),
 Object.freeze({id:'coin_to_digital_exchange',label:'Conversión Coin ↔ Digital'}),
]);

export function buildProjectLaunchStatus({destination='HN',asOf=new Date().toISOString().slice(0,10)}={}){
 if(!Object.hasOwn(RESEARCH_DESTINATIONS,destination))return null;
 const target=RESEARCH_DESTINATIONS[destination];
 const basics=buildLaunchReadinessReport({countryCode:destination});
 const fiat=assessRealMoneyLaunchReadiness({
  corridor:{origin:'US',destination,sourceCurrency:'USD',destinationCurrency:target.currency},
 });
 const phases=CRYPTO_PHASES.map(({id,label})=>{
  const result=assessCryptoReleasePhase({phase:id,asOf});
  return Object.freeze({id,label,missingEvidenceCount:result.missingEvidence.length,
   requirementCount:result.requirementCount,documentationVerified:false,
   issuanceOrTradingEnabled:false});
 });
 return Object.freeze({
  origin:'US',destination,country:target.country,sourceCurrency:'USD',
  destinationCurrency:target.currency,
  evidenceSource:'static_internal_checklist_no_independent_verification',
  demoChecks:basics.demoComponents,
  technicalChecksPending:basics.pendingVerification,
  externalChecksPending:basics.externalRequirements,
  fiatRequirementCount:fiat.requirementsCount,
  fiatRequirementsUnverified:fiat.missingRequirements.length,
  cryptoPhases:Object.freeze(phases),
  companyRegisteredConfirmed:false,regulatedPartnerContractConfirmed:false,
  authorizedCashPickupNetworkConfirmed:false,bankConnected:false,
  appInstalledOnUserDeviceConfirmed:false,
  coinIssued:false,digitalIssued:false,stableValueGuaranteed:false,
  realExchangeConnected:false,realTransfersEnabled:false,
  liveCountries:0,
  status:'research_and_demo_only',
 });
}
