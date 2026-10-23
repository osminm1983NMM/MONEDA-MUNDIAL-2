// MONEDA MUNDIAL COIN — VENTA SECUNDARIA Y GANANCIA/PÉRDIDA, SOLO DEMO.
// Ninguna moneda se ha emitido. Los lotes/valores son inventados: NO son
// posiciones compradas en Moneda Mundial, dinero, cuenta bancaria o precio real.
// Motor aislado en RAM Node, jamás usarse como API de negociación/custodia.
import {randomUUID} from 'node:crypto';

const ALIAS=/^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$/;
const REQUEST=/^[A-Za-z0-9_-]{12,90}$/;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const POS=/^[1-9][0-9]{0,15}$/;
const MAX_PLANS=500,QUOTE_MS=120000,DUPLICATE_MS=600000;
const fail=x=>{throw new Error(x)};
const frozen=x=>Object.freeze(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,keys)=>plain(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const units=(x)=>typeof x==='string'&&POS.test(x)?BigInt(x):null;

function validateFixture(f){
 if(!exact(f,['mode','scenarioUnitPriceCents','feeBps','marketBuyerCapacityUnits','sellers'])||
    f.mode!=='mock'||!Number.isSafeInteger(f.scenarioUnitPriceCents)||
    f.scenarioUnitPriceCents<1||f.scenarioUnitPriceCents>100000||
    !Number.isSafeInteger(f.feeBps)||f.feeBps<0||f.feeBps>1000||
    units(f.marketBuyerCapacityUnits)===null||!plain(f.sellers))
  fail('Parámetros del mercado ficticio inválidos; dinero real prohibido');
 const entries=Object.entries(f.sellers);
 if(entries.length<1||entries.length>15)fail('Sólo cuentas sintéticas limitadas');
 const sellers=new Map();
 for(const [alias,lots] of entries){
  if(!ALIAS.test(alias)||!Array.isArray(lots)||lots.length<1||lots.length>50)
   fail('Lotes sintéticos de venta inválidos');
  sellers.set(alias,{revision:0,initialUnits:0n,
   grossProceedsCents:0n,feesCents:0n,costBasisRemovedCents:0n,
   lots:lots.map(lot=>{
    if(!exact(lot,['coinUnits','acquisitionUnitPriceCents'])||
       units(lot.coinUnits)===null||
       !Number.isSafeInteger(lot.acquisitionUnitPriceCents)||
       lot.acquisitionUnitPriceCents<1||lot.acquisitionUnitPriceCents>100000)
      fail('Lote sintético no válido');
    const n=units(lot.coinUnits);
    return {remaining:n,acquisitionUnitPriceCents:BigInt(lot.acquisitionUnitPriceCents)};
   })
  });
  const s=sellers.get(alias);
  s.initialUnits=s.lots.reduce((n,l)=>n+l.remaining,0n);
 }
 return {sellers,price:f.scenarioUnitPriceCents,feeBps:f.feeBps,
  capacity:units(f.marketBuyerCapacityUnits)};
}
export function createMockCoinSalePortfolio({fixture,clock=()=>Date.now()}={}){
 const validated=validateFixture(fixture);
 if(typeof clock!=='function')fail('Reloj DEMO inválido');
 const {sellers}=validated;
 let price=validated.price,priceRevision=0;
 let remainingCapacity=validated.capacity,marketHolding=0n;
 const plans=new Map(),events=[];
 const originalSupply=[...sellers.values()].reduce((sum,s)=>sum+s.initialUnits,0n);
 function time(){
  const t=clock();
  if(!Number.isSafeInteger(t)||t<0||t>8640000000000000)fail('Reloj DEMO inválido');
  return t;
 }
 function seller(alias){
  if(typeof alias!=='string'||!ALIAS.test(alias)||!sellers.has(alias))
   fail('Vendedor ficticio no autorizado en el fixture');
  return sellers.get(alias);
 }
 const available=s=>s.lots.reduce((sum,l)=>sum+l.remaining,0n);
 function assertConservation(){
  const owned=[...sellers.values()].reduce((sum,s)=>sum+available(s),0n);
  if(owned+marketHolding!==originalSupply||
     remainingCapacity<0n||marketHolding>validated.capacity)
   fail('Conservación de Coin ficticia violada');
 }
 function basisOf(s,quantity){
  let left=quantity,cost=0n;
  for(const lot of s.lots){
   const used=left<lot.remaining?left:lot.remaining;
   cost+=used*lot.acquisitionUnitPriceCents;
   left-=used;
   if(left===0n)break;
  }
  if(left!==0n)fail('Saldo Coin de DEMO insuficiente');
  return cost;
 }
 function quoteView(q,old=false){
  return frozen({
   status:'sale_review_mock',requestId:q.requestId,quoteId:q.quoteId,
   sellerAlias:q.sellerAlias,coinUnits:q.coinUnits.toString(),
   hypotheticalUnitPriceCents:q.unitPriceCents,
   hypotheticalGrossUsdCents:q.gross.toString(),
   illustrativeFeeUsdCents:q.fee.toString(),
   illustrativeNetUsdCents:q.net.toString(),
   illustrativeFifoCostBasisUsdCents:q.basis.toString(),
   illustrativeProfitLossUsdCents:q.pnl.toString(),
   sellerMinimumNetUsdCents:q.minNetUsdCents.toString(),
   expiresAtMs:q.expiresAtMs,priceRevision:q.priceRevision,
   duplicateRiskDetected:q.duplicateSaleId!==null,
   previouslySimilarSaleId:q.duplicateSaleId,
   expired:old,realMarketPriceVerified:false,
   fifoForEducationNotTaxAdvice:true,taxesIncluded:false,
   gasAndNetworkFeesIncluded:false,spreadIncluded:false,
   priceGuaranteed:false,realLiquidityAvailable:false,
   actualMoneyReceived:false,tokenIssued:false,
   tradeExecuted:false,realMoneyEnabled:false,canSell:false
  });
 }
 function receipt(q,replay=false){
  return frozen({
   status:'mock_sale_recorded',saleId:q.saleId,
   requestId:q.requestId,sellerAlias:q.sellerAlias,
   coinUnits:q.coinUnits.toString(),scenarioUnitPriceCents:q.unitPriceCents,
   hypotheticalGrossUsdCents:q.gross.toString(),
   illustrativeFeeUsdCents:q.fee.toString(),
   illustrativeNetUsdCents:q.net.toString(),
   illustrativeFifoCostBasisUsdCents:q.basis.toString(),
   illustrativeProfitLossUsdCents:q.pnl.toString(),
   alreadyProcessed:replay,
   taxesCalculated:false,actualUsdReceived:false,
   actualProfitRealized:false,realMarketPriceVerified:false,
   realLiquidityAvailable:false,tokenIssued:false,
   blockchainTransfer:false,tradeExecuted:false,
   realMoneyEnabled:false,canSell:false
  });
 }
 function mostRecent(q,t){
  for(const plan of [...plans.values()].reverse())
   if(plan.saleId&&plan.sellerAlias===q.sellerAlias&&
      plan.coinUnits===q.coinUnits&&plan.unitPriceCents===q.unitPriceCents&&
      t>=plan.completedAtMs&&t-plan.completedAtMs<=DUPLICATE_MS)
    return plan;
  return null;
 }
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,tradingVenueConnected:false,
  bankConnected:false,blockchainConnected:false,stablecoinIssued:false,
  authenticatedUsersConnected:false,persistentStorageConnected:false,
  previewMockSale(input={}){
   if(!exact(input,['requestId','sellerAlias','coinUnits','minNetUsdCents']))
    fail('No enviar nombres, tarjetas, datos bancarios o campos adicionales');
   const {requestId,sellerAlias,coinUnits,minNetUsdCents}=input;
   if(typeof requestId!=='string'||!REQUEST.test(requestId)||
      !Number.isSafeInteger(minNetUsdCents)||minNetUsdCents<0||
      minNetUsdCents>1000000000000)
    fail('Solicitud de venta ficticia inválida');
   const qty=units(coinUnits),s=seller(sellerAlias),t=time();
   if(qty===null||qty>1000000000n)fail('Cantidad de Coin ficticia inválida');
   const previous=plans.get(requestId);
   if(previous){
    if(previous.sellerAlias!==sellerAlias||previous.coinUnits!==qty||
       previous.minNetUsdCents!==BigInt(minNetUsdCents))
     fail('RequestId reutilizada con otra venta ficticia');
    return previous.saleId?receipt(previous,true):
      quoteView(previous,t>=previous.expiresAtMs||previous.priceRevision!==priceRevision);
   }
   if(plans.size>=MAX_PLANS)fail('Demasiadas cotizaciones ficticias');
   if(qty>available(s)||qty>remainingCapacity)
    fail('Saldo o capacidad de mercado de prueba insuficientes');
   const gross=qty*BigInt(price);
   if(gross>1000000000000n)fail('Valor de ejemplo fuera de límites');
   const fee=(gross*BigInt(validated.feeBps)+9999n)/10000n;
   const net=gross-fee;
   if(net<=0n||net<BigInt(minNetUsdCents))
    fail('Venta de prueba por debajo del mínimo aceptado');
   const basis=basisOf(s,qty);
   const q={
    quoteId:randomUUID(),requestId,sellerAlias,coinUnits:qty,
    minNetUsdCents:BigInt(minNetUsdCents),
    unitPriceCents:price,priceRevision,sellerRevision:s.revision,
    gross,fee,net,basis,pnl:net-basis,
    expiresAtMs:t+QUOTE_MS,duplicateSaleId:null,
    saleId:null,completedAtMs:null
   };
   q.duplicateSaleId=mostRecent(q,t)?.saleId??null;
   plans.set(requestId,q);
   return quoteView(q);
  },
  confirmMockSale(input={}){
   if(!exact(input,['requestId','sellerAlias','quoteId',
                    'acceptedTerms','acknowledgedNetUsdCents',
                    'acknowledgedDistinctRepeat']))
    fail('Sólo confirmación de venta ficticia sin datos bancarios');
   const {requestId,sellerAlias,quoteId,acceptedTerms,
    acknowledgedNetUsdCents,acknowledgedDistinctRepeat}=input;
   if(typeof requestId!=='string'||!REQUEST.test(requestId)||
      typeof quoteId!=='string'||!UUID.test(quoteId)||
      typeof acceptedTerms!=='boolean'||typeof acknowledgedDistinctRepeat!=='boolean'||
      typeof acknowledgedNetUsdCents!=='string')
    fail('Confirmación de venta de prueba inválida');
   const s=seller(sellerAlias),q=plans.get(requestId);
   if(!q||q.sellerAlias!==sellerAlias||q.quoteId!==quoteId||
      q.net.toString()!==acknowledgedNetUsdCents)
    fail('Precio, vendedor o neto no coincide con la propuesta original');
   if(q.saleId)return receipt(q,true);
   if(!acceptedTerms)fail('Debe aceptar importe neto y comisiones de demostración');
   const t=time();
   if(t>=q.expiresAtMs)fail('Cotización ficticia caducada');
   if(q.priceRevision!==priceRevision||q.unitPriceCents!==price)
    fail('Precio modificado: obtener otra cotización y confirmar nuevamente');
   if(q.sellerRevision!==s.revision)
    fail('Cartera modificada: volver a calcular coste y comisión');
   const recent=mostRecent(q,t);
   if((recent?.saleId??null)!==q.duplicateSaleId)
    fail('Nueva operación semejante: revisar otra cotización');
   if(Boolean(recent)!==acknowledgedDistinctRepeat)
    fail('Venta similar requiere consentimiento diferenciado');
   if(q.coinUnits>remainingCapacity||q.coinUnits>available(s))
    fail('La contraparte o el saldo ficticio ya no está disponible');
   if(basisOf(s,q.coinUnits)!==q.basis)
    fail('Coste de adquisición ficticio cambió');
   // Transferencia puramente LOCAL hacia el recipiente inventado del mercado.
   let left=q.coinUnits;
   for(const lot of s.lots){
    const used=left<lot.remaining?left:lot.remaining;
    lot.remaining-=used;left-=used;
    if(left===0n)break;
   }
   s.revision++;
   s.grossProceedsCents+=q.gross;
   s.feesCents+=q.fee;
   s.costBasisRemovedCents+=q.basis;
   remainingCapacity-=q.coinUnits;
   marketHolding+=q.coinUnits;
   q.saleId=randomUUID();q.completedAtMs=t;
   events.push(frozen({kind:'mock_sale_verified',saleId:q.saleId,requestId}));
   assertConservation();
   return receipt(q);
  },
  inspectMockSale({requestId,sellerAlias}={}){
   if(typeof requestId!=='string'||!REQUEST.test(requestId))
    fail('Referencia ficticia inválida');
   seller(sellerAlias);
   const q=plans.get(requestId);
   if(!q)return null;
   if(q.sellerAlias!==sellerAlias)fail('Venta perteneciente a otra cuenta ficticia');
   return q.saleId?receipt(q):quoteView(q,time()>=q.expiresAtMs);
  },
  inspectSyntheticPortfolio(sellerAlias){
   const s=seller(sellerAlias);
   return frozen({
    sellerAlias,remainingCoinUnits:available(s).toString(),
    simulatedGrossProceedsCents:s.grossProceedsCents.toString(),
    simulatedFeesCents:s.feesCents.toString(),
    simulatedFifoBasisRemovedCents:s.costBasisRemovedCents.toString(),
    simulatedNetProceedsCents:(s.grossProceedsCents-s.feesCents).toString(),
    simulatedProfitLossCents:
      (s.grossProceedsCents-s.feesCents-s.costBasisRemovedCents).toString(),
    actualProfitRealized:false,ownershipVerified:false,
    bankSettlementVerified:false,realMoneyEnabled:false
   });
  },
  // Sólo tests: el precio NO viene de ninguna bolsa o proveedor real.
  simulateFixturePriceRevision(newUnitPriceCents){
   if(!Number.isSafeInteger(newUnitPriceCents)||newUnitPriceCents<1||
      newUnitPriceCents>100000)
    fail('Nuevo precio de laboratorio inválido');
   price=newUnitPriceCents;priceRevision++;
   return frozen({priceRevision,hypotheticalUnitPriceCents:price,
    realMarketPriceVerified:false,realMoneyEnabled:false});
  },
  inspectMockMarketCapacity(){
   assertConservation();
   return frozen({remainingSyntheticBuyerCapacityUnits:remainingCapacity.toString(),
    buyerFixtureCoinHoldings:marketHolding.toString(),
    totalSeededSyntheticCoinUnits:originalSupply.toString(),
    liquidityVerified:false,usdBalanceKnown:false,realMoneyEnabled:false});
  },
  sanitizedAudit(){
   return frozen(events.map(e=>frozen({...e})));
  }
 });
}
