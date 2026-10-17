// MONEDA MUNDIAL COIN — investigación de distribución y desbloqueos.
// Ningún porcentaje representa asignaciones aprobadas, tokens emitidos ni derechos.
// Las cantidades son enteras hipotéticas. "Desbloqueado" NO prueba circulación,
// cotización, rentabilidad, disponibilidad de liquidez ni ventas.
const SUPPLY=/^[1-9][0-9]{0,17}$/;
const BUCKETS=Object.freeze(['community','ecosystem','team','reserve']);
const PLAN=Object.freeze({
 balanced:Object.freeze({
  label:'Escenario de investigación A',
  portions:Object.freeze({community:35,ecosystem:30,team:15,reserve:20}),
  terms:Object.freeze({
   community:Object.freeze({initialPercent:100,cliffMonths:0,vestingMonths:0}),
   ecosystem:Object.freeze({initialPercent:20,cliffMonths:0,vestingMonths:24}),
   team:Object.freeze({initialPercent:0,cliffMonths:12,vestingMonths:36}),
   reserve:Object.freeze({initialPercent:0,cliffMonths:6,vestingMonths:48}),
  }),
 }),
 broad_distribution:Object.freeze({
  label:'Escenario de investigación B',
  portions:Object.freeze({community:50,ecosystem:25,team:10,reserve:15}),
  terms:Object.freeze({
   community:Object.freeze({initialPercent:100,cliffMonths:0,vestingMonths:0}),
   ecosystem:Object.freeze({initialPercent:10,cliffMonths:0,vestingMonths:36}),
   team:Object.freeze({initialPercent:0,cliffMonths:18,vestingMonths:42}),
   reserve:Object.freeze({initialPercent:0,cliffMonths:12,vestingMonths:60}),
  }),
 }),
});
export const COIN_ALLOCATION_RESEARCH_PLANS=PLAN;
export const COIN_ALLOCATION_BUCKETS=BUCKETS;
const immutableRows=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));

export function previewCoinUnlockScenario({maximumSupplyUnits,planId,month}={}){
 if(typeof maximumSupplyUnits!=='string'||!SUPPLY.test(maximumSupplyUnits)||
    !Number.isInteger(month)||month<0||month>120||
    typeof planId!=='string'||!Object.hasOwn(PLAN,planId))return null;
 const plan=PLAN[planId],supply=BigInt(maximumSupplyUnits);
 const portions=BUCKETS.map(k=>plan.portions[k]);
 if(portions.some(p=>!Number.isInteger(p)||p<0||p>100)||
  portions.reduce((x,n)=>x+n,0)!==100)return null;
 const allocations={};
 let apportioned=0n;
 for(const bucket of BUCKETS){
  const n=supply*BigInt(plan.portions[bucket])/100n;
  allocations[bucket]=n;
  apportioned+=n;
 }
 // Si el suministro no es divisible por 100, el residuo va a la categoría
 // reserva para mantener la identidad matemática exacta del escenario.
 const roundingRemainder=supply-apportioned;
 allocations.reserve+=roundingRemainder;
 let totalUnlocked=0n,totalLocked=0n;
 const rows=BUCKETS.map(bucket=>{
  const {initialPercent,cliffMonths,vestingMonths}=plan.terms[bucket];
  const allocated=allocations[bucket];
  const initiallyUnlocked=allocated*BigInt(initialPercent)/100n;
  const remaining=allocated-initiallyUnlocked;
  let unlocked=initiallyUnlocked;
  if(month>=cliffMonths){
   if(vestingMonths===0)unlocked=allocated;
   else unlocked+=remaining*BigInt(Math.min(month-cliffMonths,vestingMonths))/
     BigInt(vestingMonths);
  }
  const locked=allocated-unlocked;
  totalUnlocked+=unlocked;
  totalLocked+=locked;
  return {
   bucket,allocationPercent:plan.portions[bucket],
   allocatedUnits:allocated.toString(),
   initiallyUnlockedPercent:initialPercent,
   cliffMonths,vestingMonths,
   hypotheticallyUnlockedUnits:unlocked.toString(),
   hypotheticallyLockedUnits:locked.toString(),
  };
 });
 if(totalUnlocked+totalLocked!==supply)throw Error('Invariante de estudio violada');
 return Object.freeze({
  planId,planLabel:plan.label,month,
  maximumSupplyUnits:supply.toString(),
  roundingRemainderAssignedToReserveUnits:roundingRemainder.toString(),
  hypotheticallyUnlockedUnits:totalUnlocked.toString(),
  hypotheticallyLockedUnits:totalLocked.toString(),
  entries:immutableRows(rows),
  // No son tokens reales ni saldo comercializable.
  officialDistributionApproved:false,
  supplyPolicyApproved:false,tokenIssued:false,
  unlockedMeansCirculating:false,liquidityAvailable:false,
  priceDefined:false,canMint:false,canBuy:false,canSell:false,
  canSend:false,realMoneyEnabled:false,
  status:'illustrative_tokenomics_only',
 });
}
