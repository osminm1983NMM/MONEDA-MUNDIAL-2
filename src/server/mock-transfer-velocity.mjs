// Moneda Mundial 2.0 — detección de patrones únicamente en eventos INVENTADOS.
// No lee bases de datos, identidad, cuentas ni sanciones; no ejecuta bloqueos.
// Umbrales pedagógicos arbitrarios: JAMÁS usarlos como límites regulatorios.
const HOUR_MS=60*60*1000, DAY_MS=24*HOUR_MS;
const ID=/^[A-Za-z0-9_-]{12,80}$/;
const ALIAS=/^SIM-(HN|NI)-[A-Z0-9]{3,12}$/;
const ISO=/^[A-Z]{2}$/;
const OUTCOMES=new Set(['attempted_mock','rejected_mock','cancelled_mock']);
const KEYS=['eventId','actorAlias','destination','amountCents','atMs','outcome'];
const fail=m=>{throw new Error(m)};
const frozen=Object.freeze;
const limits=frozen({
 maxAttemptsPerHour:3,
 maxRejectedPerHour:2,
 maxAmountCentsPerDay:1000000,
 maxDestinationsPerDay:2,
 largeAmountCents:500000,
});
export const MOCK_VELOCITY_THRESHOLDS=limits;
const validTime=t=>Number.isSafeInteger(t)&&t>=0;
function validate(e,now){
 if(!e||typeof e!=='object'||Array.isArray(e)||
    Object.keys(e).length!==KEYS.length||!KEYS.every(k=>Object.hasOwn(e,k))||
    !ID.test(e.eventId||'')||!ALIAS.test(e.actorAlias||'')||
    !ISO.test(e.destination||'')||
    !Number.isSafeInteger(e.amountCents)||e.amountCents<100||e.amountCents>10000000||
    !validTime(e.atMs)||e.atMs>now||!OUTCOMES.has(e.outcome))
   fail('Evento de frecuencia ficticia inválido');
 return frozen({
  eventId:e.eventId,actorAlias:e.actorAlias,destination:e.destination,
  amountCents:e.amountCents,atMs:e.atMs,outcome:e.outcome
 });
}
export function assessMockTransferVelocity({events=[],nowMs}={}){
 if(!validTime(nowMs)||!Array.isArray(events)||events.length>200)
   fail('Ventana de frecuencia ficticia inválida');
 const byId=new Map(),byAlias=new Map();
 let idempotentRepeats=0;
 for(const row of events){
  const item=validate(row,nowMs);
  const fingerprint=JSON.stringify([
   item.actorAlias,item.destination,item.amountCents,item.atMs,item.outcome
  ]);
  const existing=byId.get(item.eventId);
  if(existing){
   if(existing!==fingerprint)
     fail('Identificador reutilizado con contenido diferente en ensayo');
   idempotentRepeats++;
   continue;
  }
  byId.set(item.eventId,fingerprint);
  if(!byAlias.has(item.actorAlias))byAlias.set(item.actorAlias,[]);
  byAlias.get(item.actorAlias).push(item);
 }
 if(byAlias.size>40)fail('Demasiados perfiles ficticios');
 const rows=[...byAlias].map(([alias,items])=>{
  const lastHour=items.filter(e=>nowMs-e.atMs<HOUR_MS);
  const lastDay=items.filter(e=>nowMs-e.atMs<DAY_MS);
  const destinations=new Set(lastDay.map(x=>x.destination));
  const rejectedHour=lastHour.filter(x=>x.outcome==='rejected_mock').length;
  const amountCentsDay=lastDay.reduce((sum,x)=>sum+x.amountCents,0);
  const signals=[];
  if(lastHour.length>limits.maxAttemptsPerHour)signals.push('multiple_attempts_in_hour_mock');
  if(rejectedHour>limits.maxRejectedPerHour)signals.push('rejected_attempts_in_hour_mock');
  if(amountCentsDay>limits.maxAmountCentsPerDay)signals.push('illustrative_daily_volume_mock');
  if(destinations.size>limits.maxDestinationsPerDay)signals.push('multiple_destinations_in_day_mock');
  if(lastDay.some(e=>e.amountCents>=limits.largeAmountCents))
   signals.push('illustrative_high_amount_mock');
  return frozen({
   alias,eventsTotal:items.length,attemptsHour:lastHour.length,
   rejectedHour,amountCentsDay,destinationCountDay:destinations.size,
   signals:frozen(signals),requiresManualReview:signals.length>0,
   fraudConfirmed:false,identityVerified:false,sanctionsScreened:false,
   riskCleared:false,canBlockRealFunds:false,canReleaseRealFunds:false,
   canPay:false,realMoneyEnabled:false
  });
 }).sort((a,b)=>a.alias.localeCompare(b.alias));
 return frozen({
  source:'synthetic_examples_only',
  window:'rolling_1h_and_24h',
  totalUniqueEvents:byId.size,idempotentRepeats,
  cases:rows.length,
  requiresReview:rows.filter(r=>r.requiresManualReview).length,
  results:frozen(rows),
  thresholdsForProduction:false,realAccountsConnected:false,
  realMoneyEnabled:false,canExecute:false,canApprove:false
 });
}
