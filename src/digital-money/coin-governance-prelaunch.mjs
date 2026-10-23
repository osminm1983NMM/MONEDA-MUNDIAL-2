// MONEDA MUNDIAL COIN — escenarios de distribución y controles PRE-LANZAMIENTO.
// Sólo diseño matemático. No emite tokens, custodia activos ni concede permisos.
const POS=/^[1-9][0-9]{0,17}$/;
const NONNEG=/^(0|[1-9][0-9]{0,17})$/;
const MAX=1000000000000000000n;
const ALLOC=['hypotheticalMaxSupplyUnits','initialCompanyTreasuryUnits',
 'plannedPublicUnits','plannedPartnerUnits','plannedLiquidityUnits','plannedCommunityUnits','adminPowers'];
const POWERS=['unlimitedFutureMint','clawbackFromBuyers','hiddenTransferRestrictions','guaranteedProfitMarketing'];
const legalItems=[
 ['sec_transaction_and_investment_contract_review','independent_legal_counsel'],
 ['fincen_msb_bsa_scope_assessment','independent_legal_counsel'],
 ['state_and_international_licenses_assessment','independent_legal_counsel'],
 ['ofac_aml_kyc_controls_assessment','compliance_professional'],
 ['token_rights_whitepaper_and_marketing_disclosures','independent_legal_counsel'],
 ['smart_contract_keys_mint_pause_and_access_audit','independent_security_auditor'],
 ['treasury_custody_and_fund_segregation_review','independent_security_auditor'],
 ['exchange_and_distributor_contract_assessment','independent_legal_counsel'],
 ['customer_cost_tax_disputes_and_support_review','independent_legal_counsel'],
 ['coin_digital_stablecoin_separation_review','independent_legal_counsel'],
];
const PLAIN=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>PLAIN(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const strAmount=(x,positive=false)=>typeof x==='string'&&
 (positive?POS:NONNEG).test(x)&&BigInt(x)<=MAX?BigInt(x):null;
const frozen=o=>Object.freeze(o);
const fmtBps=(a,total)=>(a*10000n/total).toString();
const isoDate=x=>{
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
 const dt=new Date(x+'T00:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===x;
};

export const COIN_PRELAUNCH_REQUIREMENTS=frozen(legalItems.map(([id,requiredReviewer])=>
 frozen({id,requiredReviewer,documentationOnly:true,legalPermissionEstablished:false})
));

// El máximo de 1,000 millones y las transferencias planeadas no son emisión aprobada.
// La empresa puede administrar su propia tesorería, NO apropiarse de activos vendidos.
export function previewCoinTreasuryGovernance(input={}){
 if(!exact(input,ALLOC)||!exact(input.adminPowers,POWERS)||
    POWERS.some(p=>typeof input.adminPowers[p]!=='boolean'))return null;
 const maximum=strAmount(input.hypotheticalMaxSupplyUnits,true);
 const initial=strAmount(input.initialCompanyTreasuryUnits);
 const publicUnits=strAmount(input.plannedPublicUnits);
 const partners=strAmount(input.plannedPartnerUnits);
 const liquidity=strAmount(input.plannedLiquidityUnits);
 const community=strAmount(input.plannedCommunityUnits);
 if([maximum,initial,publicUnits,partners,liquidity,community].some(v=>v===null)||
    initial>maximum)return null;
 const planned=publicUnits+partners+liquidity+community;
 if(planned>initial)return null;
 const remaining=initial-planned;
 const flags=[];
 if(initial*10000n/maximum>=8000n)flags.push('initial_treasury_concentration_requires_review');
 if(input.adminPowers.unlimitedFutureMint)flags.push('uncapped_mint_authority_requires_review');
 if(input.adminPowers.clawbackFromBuyers)flags.push('unilateral_holder_clawback_requires_review');
 if(input.adminPowers.hiddenTransferRestrictions)flags.push('undisclosed_transfer_restrictions_require_review');
 if(input.adminPowers.guaranteedProfitMarketing)flags.push('profit_guarantee_marketing_requires_review');
 const portions=frozen({
  public:publicUnits.toString(),partnerProgram:partners.toString(),
  liquidity:liquidity.toString(),community:community.toString(),
 });
 return frozen({
  kind:'hypothetical_distribution_only',
  hypotheticalMaxSupplyUnits:maximum.toString(),
  initiallyControlledTreasuryUnits:initial.toString(),
  proposedDistributions:portions,
  totalPlannedDistributions:planned.toString(),
  companyTreasuryRemainingAfterPlan:remaining.toString(),
  notInCompanyTreasuryAtStart:(maximum-initial).toString(),
  proposedDistributionShareBps:frozen({
   public:fmtBps(publicUnits,maximum),
   partnerProgram:fmtBps(partners,maximum),
   liquidity:fmtBps(liquidity,maximum),
   community:fmtBps(community,maximum),
   companyRemaining:fmtBps(remaining,maximum),
  }),
  concentrationRiskSignals:frozen(flags),
  governanceAndHolderRightsRequireLegalReview:true,
  noRightToClawBackBuyersTokens:true,
  partnersAreNotAutomaticallyPaid:true,
  companyDoesNotOwnTokensSoldToBuyers:true,
  maximumSupplyApproved:false,
  publicSaleAuthorized:false,
  legalClassificationVerified:false,
  stablecoinIssuerApproved:false,
  externalExchangeListingApproved:false,
  tokenIssued:false,
  companyRealTreasuryOwned:false,
  digitalStablecoinIssued:false,
  tradingEnabled:false,
  realFundsEnabled:false,
 });
}

// Los registros están AUTO-DECLARADOS. Un formulario completado NO concede
// autorización, verificación de licencia, aprobación SEC ni permiso para operar.
export function assessCoinPrelaunchEvidence({asOf,records={}}={}){
 const validDate=isoDate(asOf);
 if(!PLAIN(records))records={};
 const missing=[],accepted=[];
 for(const item of COIN_PRELAUNCH_REQUIREMENTS){
  const v=records[item.id];
  const acceptedRecord=validDate&&exact(v,['scope','reviewerRole','reference','reviewedOn','expiresOn'])&&
   v.scope==='coin_primary_issuance_us'&&v.reviewerRole===item.requiredReviewer&&
   typeof v.reference==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/#-]{7,119}$/.test(v.reference)&&
   isoDate(v.reviewedOn)&&isoDate(v.expiresOn)&&
   v.reviewedOn<=asOf&&v.expiresOn>=asOf&&v.reviewedOn<=v.expiresOn;
  if(acceptedRecord)accepted.push(item.id);
  else missing.push(item.id);
 }
 return frozen({
  kind:'coin_prelaunch_documentation_only',
  inputDateValid:validDate,
  requirementsTotal:COIN_PRELAUNCH_REQUIREMENTS.length,
  structurallyDescribedRecords:accepted.length,
  missingRequirements:frozen(missing),
  documentsDescribed:validDate&&missing.length===0,
  independentlyVerified:false,
  approvalByRegulatorConfirmed:false,
  legalCounselApprovedLaunch:false,
  allJurisdictionsLicensed:false,
  publicOfferAllowed:false,
  companyCanCollectSaleProceeds:false,
  stablecoinCanBeIssued:false,
  cryptoConversionEnabled:false,
  onchainDeployAllowed:false,
  tradingEnabled:false,
  realFundsEnabled:false,
  status:!validDate?'invalid_date':'legal_and_compliance_review_required',
 });
}
