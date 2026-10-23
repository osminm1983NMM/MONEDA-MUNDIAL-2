// MONEDA MUNDIAL COIN — compra con términos visibles, SÓLO LABORATORIO.
// No autoriza ni recibe dinero real. Usa venta primaria ficticia en memoria.
// Nunca conectar a cliente real, banco, proveedor, blockchain o stablecoin.
const ID=/^[A-Za-z0-9_-]{12,90}$/;
const ALIAS=/^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$/;
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const POS=/^[1-9][0-9]{0,17}$/;
const TEN_MINUTES=600000,MAX_PLANS=500;
const fail=m=>{throw new Error(m)};
const frozen=o=>Object.freeze(o);
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null)&&
 Object.keys(o).sort().join('|')===keys.slice().sort().join('|');

export function createMockCoinPurchaseGuard({primarySale,clock=()=>Date.now()}={}){
 if(primarySale?.mode!=='mock_only'||primarySale?.realMoneyEnabled!==false||
    primarySale?.liveTradingEnabled!==false||
    typeof primarySale.previewPrimaryPurchase!=='function'||
    typeof primarySale.confirmMockPrimaryPurchase!=='function'||
    typeof primarySale.inspectMockPurchase!=='function'||
    typeof clock!=='function')
  fail('Se requiere tesorería de venta ficticia; operaciones reales BLOQUEADAS');
 const plans=new Map(),audit=[];
 function now(){
  const t=clock();
  if(!Number.isSafeInteger(t)||t<0||t>8640000000000000)
   fail('Reloj DEMO inválido');
  return t;
 }
 function validateBuyer(buyerAlias){
  if(typeof buyerAlias!=='string'||!ALIAS.test(buyerAlias))
   fail('Sólo alias sintéticos, nunca identidad real');
 }
 function quoteSafe(q,i,t){
  if(!q||q.status!=='quote_mock'||!UUID.test(q.quoteId||'')||
     q.requestId!==i.requestId||q.buyerAlias!==i.buyerAlias||
     q.spendUsdCents!==i.spendUsdCents||
     !Number.isSafeInteger(q.hypotheticalUnitPriceUsdCents)||
     q.hypotheticalUnitPriceUsdCents<=0||
     typeof q.coinUnits!=='string'||!POS.test(q.coinUnits)||
     !POS.test(q.feeCents||'')&&q.feeCents!=='0'||
     !/^(0|[1-9][0-9]{0,17})$/.test(q.partnerFeeCents||'')||
     !/^(0|[1-9][0-9]{0,17})$/.test(q.platformFeeCents||'')||
     !POS.test(q.buyerTotalUsdCents||'')||
     !Number.isSafeInteger(q.expiresAtMs)||q.expiresAtMs<=t||
     q.priceFromMarket!==false||q.paymentReceived!==false||
     q.tokensIssued!==false||q.custodyEstablished!==false||
     q.realMoneyEnabled!==false||q.executable!==false||
     q.feesIllustrativeOnly!==true)
   fail('Cotización Coin no verificada: bloqueo preventivo');
  const principal=BigInt(i.spendUsdCents);
  const fee=BigInt(q.feeCents),partner=BigInt(q.partnerFeeCents);
  const platform=BigInt(q.platformFeeCents),total=BigInt(q.buyerTotalUsdCents);
  if(partner+platform!==fee||principal+fee!==total||
     BigInt(q.coinUnits)*BigInt(q.hypotheticalUnitPriceUsdCents)!==principal||
     fee>(principal*1000n+9999n)/10000n)
   fail('Precio o desglose de comisiones contradictorio en DEMO');
  if(total>BigInt(i.maximumBuyerTotalCents))
   fail('La compra de prueba supera el importe máximo autorizado por el comprador');
  return frozen({
   quoteId:q.quoteId,expiresAtMs:q.expiresAtMs,requestId:i.requestId,
   buyerAlias:i.buyerAlias,spendUsdCents:i.spendUsdCents,
   unitPriceCents:q.hypotheticalUnitPriceUsdCents,
   coinUnits:q.coinUnits,feeCents:q.feeCents,
   partnerFeeCents:q.partnerFeeCents,platformFeeCents:q.platformFeeCents,
   totalCents:q.buyerTotalUsdCents,maximumBuyerTotalCents:i.maximumBuyerTotalCents,
  });
 }
 function fingerprint(p){
  return JSON.stringify([p.buyerAlias,p.spendUsdCents,p.unitPriceCents,p.coinUnits]);
 }
 function mostRecent(p,t){
  for(const x of [...plans.values()].reverse())
   if(x.state==='completed'&&x.receipt&&x.fingerprint===fingerprint(p)&&
      t>=x.completedAt&&t-x.completedAt<=TEN_MINUTES)
    return x;
  return null;
 }
 function otherUncertainBuyer(p){
  return [...plans.values()].some(x=>x!==p&&x.state==='pending'&&
   x.quote.buyerAlias===p.quote.buyerAlias);
 }
 function previewResponse(p){
  const q=p.quote;
  return frozen({
   status:'terms_review_mock',quoteId:q.quoteId,requestId:q.requestId,
   buyerAlias:q.buyerAlias,spendUsdCents:q.spendUsdCents,
   hypotheticalUnitPriceCents:q.unitPriceCents,coinUnits:q.coinUnits,
   platformFeeCents:q.platformFeeCents,partnerFeeCents:q.partnerFeeCents,
   feeTotalCents:q.feeCents,buyerTotalCents:q.totalCents,
   buyerMaximumTotalCents:q.maximumBuyerTotalCents,
   expiresAtMs:q.expiresAtMs,
   duplicateRiskDetected:p.duplicatePurchaseId!==null,
   priorMockPurchaseId:p.duplicatePurchaseId,
   termsAreHypothetical:true,priceVerifiedByExchange:false,
   feePartnerActuallyPaid:false,stablecoinIssued:false,
   realTokensIssued:false,realMoneyEnabled:false,executable:false
  });
 }
 function uncertainResponse(p,reason='outcome_unverified_mock'){
  return frozen({
   status:reason,requestId:p.quote.requestId,buyerAlias:p.quote.buyerAlias,
   quoteId:p.quote.quoteId,
   mayHaveRecordedSimulatedSale:true,safeToSubmitAgain:false,
   moneyReceived:false,tokensIssued:false,
   realMoneyEnabled:false,executable:false
  });
 }
 function verifyReceipt(r,p){
  const q=p.quote;
  return Boolean(r&&r.status==='simulated_sale_only'&&
   typeof r.purchaseId==='string'&&UUID.test(r.purchaseId)&&
   r.quoteId===q.quoteId&&r.requestId===q.requestId&&
   r.buyerAlias===q.buyerAlias&&r.spentUsdCents===q.spendUsdCents&&
   r.coinUnits===q.coinUnits&&r.buyerTotalUsdCents===q.totalCents&&
   r.illustrativePlatformFeeCents===q.platformFeeCents&&
   r.illustrativePartnerFeeCents===q.partnerFeeCents&&
   r.issuerGrossIsNetProfit===false&&r.partnerActuallyPaid===false&&
   r.usdReceived===false&&r.blockchainTransfer===false&&
   r.realTokensIssued===false&&r.realMoneyEnabled===false&&
   r.canTradeRealAssets===false);
 }
 function completedResponse(p,again=false){
  return frozen({
   status:'simulated_sale_only',requestId:p.quote.requestId,
   purchaseId:p.receipt.purchaseId,coinUnits:p.quote.coinUnits,
   buyerAlias:p.quote.buyerAlias,
   buyerTotalCents:p.quote.totalCents,
   illustrativeFeeCents:p.quote.feeCents,
   repeatPurchaseAcknowledged:p.duplicatePurchaseId!==null,
   alreadyProcessed:again,companyDoesNotOwnCustomerUnits:true,
   bankFundsVerified:false,realMoneyEnabled:false,tokenIssued:false,
   actualSale:false,canTrade:false
  });
 }
 function recordCompleted(p,r,t){
  p.state='completed';
  p.receipt=frozen({...r});
  p.completedAt=t;
  audit.push(frozen({
   kind:'synthetic_purchase_verified',requestId:p.quote.requestId,
   purchaseId:r.purchaseId
  }));
 }
 return frozen({
  mode:'mock_only',realMoneyEnabled:false,
  bankConnected:false,customerIdentityVerified:false,persistenceEnabled:false,
  previewSafePurchase(input={}){
   if(!exact(input,['requestId','buyerAlias','spendUsdCents','maximumBuyerTotalCents']))
    fail('No se admiten datos bancarios ni campos adicionales');
   const {requestId,buyerAlias,spendUsdCents,maximumBuyerTotalCents}=input;
   if(typeof requestId!=='string'||!ID.test(requestId)||
      !Number.isSafeInteger(maximumBuyerTotalCents)||maximumBuyerTotalCents<100||
      maximumBuyerTotalCents>11000000)
    fail('Solicitud Coin DEMO inválida');
   validateBuyer(buyerAlias);
   const existing=plans.get(requestId),t=now();
   if(existing){
    if(existing.quote.buyerAlias!==buyerAlias||
       existing.quote.spendUsdCents!==spendUsdCents||
       existing.quote.maximumBuyerTotalCents!==maximumBuyerTotalCents)
     fail('Referencia reutilizada con condiciones diferentes');
    return existing.state==='completed'?completedResponse(existing,true):
      existing.state==='pending'?uncertainResponse(existing):previewResponse(existing);
   }
   if(plans.size>=MAX_PLANS)fail('Capacidad de laboratorio agotada');
   if([...plans.values()].some(x=>x.state==='pending'&&x.quote.buyerAlias===buyerAlias))
    fail('Existe otra compra de prueba sin resultado verificable: investigar antes de crear otra');
   const raw=primarySale.previewPrimaryPurchase({requestId,buyerAlias,spendUsdCents});
   const quote=quoteSafe(raw,{...input},t);
   const dup=mostRecent(quote,t);
   const plan={quote,fingerprint:fingerprint(quote),
    duplicatePurchaseId:dup?.receipt?.purchaseId??null,state:'review'};
   plans.set(requestId,plan);
   return previewResponse(plan);
  },
  confirmSafePurchase(input={}){
   if(!exact(input,['requestId','quoteId','buyerAlias',
                    'acknowledgedBuyerTotalCents','acknowledgedCoinUnits',
                    'acceptedTerms','acknowledgedDistinctRepeat']))
    fail('No se admiten parámetros de pago, datos personales ni claves');
   const {requestId,quoteId,buyerAlias,acknowledgedBuyerTotalCents,
    acknowledgedCoinUnits,acceptedTerms,acknowledgedDistinctRepeat}=input;
   if(typeof requestId!=='string'||!ID.test(requestId)||!UUID.test(quoteId||'')||
      typeof acceptedTerms!=='boolean'||typeof acknowledgedDistinctRepeat!=='boolean')
    fail('Confirmación ficticia inválida');
   validateBuyer(buyerAlias);
   const p=plans.get(requestId);
   if(!p||p.quote.quoteId!==quoteId||p.quote.buyerAlias!==buyerAlias||
      p.quote.totalCents!==String(acknowledgedBuyerTotalCents)||
      p.quote.coinUnits!==String(acknowledgedCoinUnits))
    fail('No coinciden importe, unidades, usuario o cotización de prueba');
   if(p.state==='completed')return completedResponse(p,true);
   if(p.state==='pending')return uncertainResponse(p);
   if(!acceptedTerms)fail('El cliente debe aceptar precio y comisiones visibles');
   const t=now();
   if(t>=p.quote.expiresAtMs)fail('Cotización ficticia vencida');
   if(otherUncertainBuyer(p))fail('Existe compra pendiente de verificar de este comprador');
   const dup=mostRecent(p.quote,t);
   if((dup?.receipt?.purchaseId??null)!==p.duplicatePurchaseId)
    fail('Ha cambiado el contexto de compras recientes: revisar una nueva cotización');
   if(Boolean(dup)!==acknowledgedDistinctRepeat)
    fail('La operación repetida requiere una autorización diferenciada');
   // Estado incierto ANTES de confirmar: si la respuesta se pierde, sólo inspección.
   p.state='pending';
   let result;
   try{
    result=primarySale.confirmMockPrimaryPurchase({
     requestId,quoteId,buyerAlias,acceptedIllustrativeTerms:true
    });
   }catch{
    return uncertainResponse(p);
   }
   if(!verifyReceipt(result,p))return uncertainResponse(p,'inconsistent_response_mock');
   recordCompleted(p,result,t);
   return completedResponse(p);
  },
  recoverWithoutResubmitting({requestId,buyerAlias}={}){
   if(typeof requestId!=='string'||!ID.test(requestId))
    fail('Referencia DEMO inválida');
   validateBuyer(buyerAlias);
   const p=plans.get(requestId);
   if(!p)return null;
   if(p.quote.buyerAlias!==buyerAlias)fail('Consulta a otra billetera ficticia');
   if(p.state==='completed')return completedResponse(p,true);
   if(p.state!=='pending')return previewResponse(p);
   let result;
   try{result=primarySale.inspectMockPurchase({requestId,buyerAlias});}
   catch{return uncertainResponse(p);}
   if(result===null)return uncertainResponse(p,'not_observed_but_unresolved_mock');
   if(!verifyReceipt(result,p))return uncertainResponse(p,'inconsistent_response_mock');
   recordCompleted(p,result,now());
   return completedResponse(p);
  },
  getSanitizedAudit(){return frozen(audit.map(x=>frozen({...x})));},
 });
}
