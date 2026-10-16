// MONEDA MUNDIAL COIN — estudio de tokenomics, NUNCA emisión ni valoración.
// Acepta hipótesis introducidas manualmente. No establece suministro oficial
// ni precio y no tiene conexión con wallets, contratos, testnets o Supabase.
// Para evitar inflación por redondeo usamos cantidades ENTERAS en BigInt.
const INTEGER=/^(0|[1-9][0-9]{0,17})$/;
const MAX_YEARS=100;
const ALLOCATION_KEYS=Object.freeze(['community','ecosystem','team','reserve']);
const output = (value)=>value.toString();
const amount=(value,allowZero=false)=>{
  if(typeof value!=='string'||!INTEGER.test(value.trim()))return null;
  const n=BigInt(value.trim());
  return (!allowZero&&n===0n)?null:n;
};

export const TOKEN_DISTRIBUTION_BUCKETS=ALLOCATION_KEYS;
export const TOKEN_POLICY_MODES=Object.freeze(['no_future_mint','capped_scheduled_mint']);

/**
 * Cuantifica un escenario de oferta máxima y emisión, sin elegir una política.
 * - maxSupply: máximo hipotético (NO aprobado).
 * - initialMint: unidades hipotéticas emitidas inicialmente.
 * - annualMint: unidades hipotéticas nuevas por año (para escenario programado).
 * - years: horizonte 0..100, NO cronograma de ventas.
 * - allocations: porcentajes enteros (de emisión inicial, NO propiedad real).
 */
export function evaluateTokenSupplyScenario({
  maxSupply,initialMint,annualMint='0',years=0,
  mode='no_future_mint',allocations,
}={}){
  if(!TOKEN_POLICY_MODES.includes(mode)||!Number.isInteger(years)||
     years<0||years>MAX_YEARS)return null;
  const cap=amount(maxSupply),initial=amount(initialMint);
  const annual=amount(annualMint,true);
  if(cap===null||initial===null||annual===null||initial>cap)return null;
  if(mode==='no_future_mint'&&annual!==0n)return null;
  if(mode==='capped_scheduled_mint'&&annual===0n)return null;
  if(!allocations||typeof allocations!=='object'||Array.isArray(allocations))return null;
  let sum=0;
  const dist={};
  for(const name of ALLOCATION_KEYS){
    const n=allocations[name];
    if(!Number.isInteger(n)||n<0||n>100)return null;
    sum+=n;
    // Porcentajes exactos; fracciones representan unidades del token
    // divisibles, NO una emisión real.
    const raw=initial*BigInt(n);
    dist[name]=Object.freeze({percent:n,
      units:output(raw/100n),fractionalRemainder:output(raw%100n)});
  }
  if(sum!==100)return null;
  const projected=initial+annual*BigInt(years);
  if(projected>cap)return null;
  return Object.freeze({
    mode,years,
    hypotheticalMaxSupply:output(cap),
    hypotheticalInitialMint:output(initial),
    hypotheticalAnnualMint:output(annual),
    hypotheticalProjectedSupply:output(projected),
    hypotheticalRemainingCapacity:output(cap-projected),
    hypotheticalAllocation:Object.freeze(dist),
    supplyPolicyApproved:false,
    tokenIssued:false,blockchainSelected:false,
    activeTokenPriceUsd:null,stablecoinPriceUsd:null,
    realPurchasesEnabled:false,realPaymentsEnabled:false,
    canDeployContract:false,canSellToken:false,
    message:'ESCENARIO MATEMÁTICO. Oferta, distribución, precio y red por decidir; no existe moneda emitida.',
  });
}
