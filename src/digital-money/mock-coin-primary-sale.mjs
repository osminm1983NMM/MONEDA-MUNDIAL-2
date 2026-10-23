// MONEDA MUNDIAL COIN: estudio de venta PRIMARIA desde tesorería ficticia.
// SIN tokens emitidos, contratos, exchange, cobrador de USD ni Digital estable.
// Los saldos en este ejemplo existen únicamente en memoria Node (BigInt).
// No firmar, publicar, conectar a una app financiera ni usar datos personales.
import {randomUUID} from 'node:crypto';

const UNITS=/^[1-9][0-9]{0,17}$/;
const ID=/^[A-Za-z0-9_-]{12,90}$/;
const ALIAS=/^SIM-[A-Z]{2}-[A-Z0-9]{3,12}$/;
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MAX_QUOTES=1000;
const QUOTE_MS=120000;
const bad=reason=>{throw Error(reason);};
const frozen=o=>Object.freeze(o);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null)&&
 Object.keys(o).sort().join('|')===keys.slice().sort().join('|');
const validPositiveUnits=x=>typeof x==='string'&&UNITS.test(x)?BigInt(x):null;

function safeConfig(config){
 if(!exact(config,['mode','maximumSupplyUnits','treasuryInventoryUnits',
                    'hypotheticalPriceUsdCents','feeBps','partnerFeeShareBps']))
  bad('Configuración de oferta sólo DEMO inválida');
 if(config.mode!=='mock')bad('Se prohíbe vender Coin real');
 const max=validPositiveUnits(config.maximumSupplyUnits);
 const stock=validPositiveUnits(config.treasuryInventoryUnits);
 const price=config.hypotheticalPriceUsdCents;
 if(max===null||stock===null||stock>max||
    !Number.isSafeInteger(price)||price<1||price>100000||
    !Number.isInteger(config.feeBps)||config.feeBps<0||config.feeBps>1000||
    !Number.isInteger(config.partnerFeeShareBps)||
    config.partnerFeeShareBps<0||config.partnerFeeShareBps>10000)
  bad('Precio, distribución o comisiones de prueba inválidos');
 return frozen({...config,max,stock});
}
function quoteMath(c,spendUsdCents){
 if(!Number.isSafeInteger(spendUsdCents)||spendUsdCents<100||
    spendUsdCents>10000000||spendUsdCents%c.hypotheticalPriceUsdCents!==0)
  bad('El importe ficticio debe ser múltiplo exacto del precio ilustrativo');
 const quantity=BigInt(spendUsdCents/c.hypotheticalPriceUsdCents);
 if(quantity===0n)bad('Cantidad de Coin de prueba inválida');
 const fee=(BigInt(spendUsdCents)*BigInt(c.feeBps)+9999n)/10000n;
 const partner=(fee*BigInt(c.partnerFeeShareBps))/10000n;
 const platform=fee-partner;
 const total=BigInt(spendUsdCents)+fee;
 if(!Number.isSafeInteger(Number(total)))bad('Importe de ejemplo demasiado alto');
 return frozen({coinUnits:quantity,feeCents:fee,partnerFeeCents:partner,
  platformFeeCents:platform,totalBuyerCents:total});
}

export function createMockCoinPrimarySale({config,clock=()=>Date.now()}={}){
 const c=safeConfig(config);
 if(typeof clock!=='function')bad('Reloj de laboratorio inválido');
 let treasury=c.stock,principalCents=0n,platformFeeCents=0n,partnerFeeCents=0n;
 const customers=new Map(),quotes=new Map(),byRequest=new Map(),events=[];
 const time=()=>{
  const t=clock();
  if(!Number.isSafeInteger(t)||t<0||t>8640000000000000)bad('Reloj ficticio inválido');
  return t;
 };
 function buyerAlias(alias) {
  if(typeof alias!=='string'||!ALIAS.test(alias))bad('Sólo alias sintéticos');
  return alias;
 }
 function snapshot(q){
  return frozen({
   status:'quote_mock',quoteId:q.quoteId,requestId:q.requestId,
   buyerAlias:q.buyerAlias,spendUsdCents:q.spendUsdCents,
   hypotheticalUnitPriceUsdCents:c.hypotheticalPriceUsdCents,
   coinUnits:q.math.coinUnits.toString(),feeCents:q.math.feeCents.toString(),
   partnerFeeCents:q.math.partnerFeeCents.toString(),
   platformFeeCents:q.math.platformFeeCents.toString(),
   buyerTotalUsdCents:q.math.totalBuyerCents.toString(),
   expiresAtMs:q.expiresAtMs,feesIllustrativeOnly:true,
   priceFromMarket:false,paymentReceived:false,tokensIssued:false,
   custodyEstablished:false,realMoneyEnabled:false,executable:false
  });
 }
 function receipt(x,alreadyProcessed=false){
  return frozen({
   status:'simulated_sale_only',purchaseId:x.purchaseId,
   quoteId:x.quoteId,requestId:x.requestId,buyerAlias:x.buyerAlias,
   spentUsdCents:x.spendUsdCents,coinUnits:x.math.coinUnits.toString(),
   buyerTotalUsdCents:x.math.totalBuyerCents.toString(),
   illustrativeIssuerGrossSaleCents:x.spendUsdCents,
   illustrativePlatformFeeCents:x.math.platformFeeCents.toString(),
   illustrativePartnerFeeCents:x.math.partnerFeeCents.toString(),
   alreadyProcessed,issuerGrossIsNetProfit:false,
   partnerActuallyPaid:false,usdReceived:false,
   blockchainTransfer:false,realTokensIssued:false,
   realMoneyEnabled:false,canTradeRealAssets:false,
  });
 }
 function assertConservation(){
  const allocated=[...customers.values()].reduce((sum,n)=>sum+n,0n);
  if(treasury<0n||allocated<0n||treasury+allocated!==c.stock)
   bad('Error de conservación de monedas ficticias');
  if(principalCents<0n||platformFeeCents<0n||partnerFeeCents<0n)
   bad('Registro de comisiones inconsistente');
 }
 return frozen({
  mode:'mock_only',liveTradingEnabled:false,tokenContractDeployed:false,
  selectedChain:null,licensesVerified:false,kycConnected:false,
  bankConnected:false,marketMakerConnected:false,
  custodyPartnerConnected:false,realMoneyEnabled:false,
  // La empresa sólo controla el inventario que AÚN es suyo en este ejemplo.
  // Ningún método permite quitar unidades que ya fueron atribuidas al comprador.
  previewPrimaryPurchase(input={}){
   if(!exact(input,['requestId','buyerAlias','spendUsdCents']))
    bad('Sólo importes y alias sintéticos permitidos; prohibidos datos bancarios');
   const {requestId,buyerAlias:alias,spendUsdCents}=input;
   if(typeof requestId!=='string'||!ID.test(requestId))
    bad('Referencia de intento ficticio inválida');
   buyerAlias(alias);
   const existing=quotes.get(requestId),t=time();
   if(existing){
    if(existing.buyerAlias!==alias||existing.spendUsdCents!==spendUsdCents)
     bad('Solicitud repetida con comprador o importe diferente');
    // Una misma referencia NUNCA genera nueva cotización al caducar.
    return frozen({...snapshot(existing),quoteExpired:t>=existing.expiresAtMs});
   }
   if(quotes.size>=MAX_QUOTES)bad('Límite de cotizaciones del laboratorio');
   const math=quoteMath(c,spendUsdCents);
   if(math.coinUnits>treasury)bad('Tesorería ficticia insuficiente');
   const expiresAtMs=t+QUOTE_MS;
   if(!Number.isSafeInteger(expiresAtMs))bad('Vencimiento inválido');
   const q=frozen({quoteId:randomUUID(),requestId,buyerAlias:alias,
    spendUsdCents,math,expiresAtMs});
   quotes.set(requestId,q);
   return frozen({...snapshot(q),quoteExpired:false});
  },
  confirmMockPrimaryPurchase({quoteId,requestId,buyerAlias:alias,
                              acceptedIllustrativeTerms=false}={}){
   if(typeof quoteId!=='string'||!UUID.test(quoteId)||
      typeof requestId!=='string'||!ID.test(requestId)||
      typeof acceptedIllustrativeTerms!=='boolean')
    bad('Confirmación ficticia inválida');
   buyerAlias(alias);
   const q=quotes.get(requestId),past=byRequest.get(requestId);
   if(!q||q.quoteId!==quoteId||q.buyerAlias!==alias)
    bad('Cotización no coincide con la operación');
   if(past)return receipt(past,true); // NO altera saldo ni tarifa en reintento.
   if(!acceptedIllustrativeTerms)
    bad('Revisión expresa del precio y comisión ficticios requerida');
   if(time()>=q.expiresAtMs)bad('Cotización de muestra vencida');
   if(q.math.coinUnits>treasury)bad('No queda inventario ficticio suficiente');
   // Movimiento totalmente local/síncrono entre tesorería y comprador ficticios.
   treasury-=q.math.coinUnits;
   customers.set(alias,(customers.get(alias)||0n)+q.math.coinUnits);
   principalCents+=BigInt(q.spendUsdCents);
   platformFeeCents+=q.math.platformFeeCents;
   partnerFeeCents+=q.math.partnerFeeCents;
   const saved=frozen({...q,purchaseId:randomUUID()});
   byRequest.set(requestId,saved);
   events.push(frozen({kind:'mock_primary_sale',requestId,purchaseId:saved.purchaseId}));
   assertConservation();
   return receipt(saved);
  },
  inspectMockPurchase({requestId,buyerAlias:alias}={}){
   if(typeof requestId!=='string'||!ID.test(requestId))bad('Referencia inválida');
   buyerAlias(alias);
   const q=quotes.get(requestId);
   if(q&&q.buyerAlias!==alias)bad('Consulta cruzada a otra cuenta ficticia');
   const saved=byRequest.get(requestId);
   return saved?receipt(saved):null;
  },
  inspectSyntheticBuyerBalance(alias){
   buyerAlias(alias);
   return frozen({buyerAlias:alias,coinUnits:(customers.get(alias)||0n).toString(),
    sellerCanUnilaterallyClawBack:false,realTokenBalance:false,
    propertyRightsDetermined:false,realMoneyEnabled:false});
  },
  getMockTreasuryReport(){
   assertConservation();
   const sold=c.stock-treasury;
   return frozen({
    hypotheticalMaximumSupplyUnits:c.maximumSupplyUnits,
    initialTreasuryUnits:c.treasuryInventoryUnits,
    treasuryRemainingUnits:treasury.toString(),
    soldToSyntheticBuyersUnits:sold.toString(),
    illustrativeIssuerGrossSaleUsdCents:principalCents.toString(),
    illustrativePlatformFeeUsdCents:platformFeeCents.toString(),
    illustrativePartnerFeeUsdCents:partnerFeeCents.toString(),
    issuerGrossIsNetProfit:false,partnerActuallyPaid:false,
    maximumSupplyApproved:false,companyOwnsBuyerUnits:false,
    marketPriceKnown:false,marketLiquidityGuaranteed:false,
    tokensIssued:false,reservesVerified:false,realMoneyEnabled:false
   });
  },
  sanitizedMockAudit(){
   return frozen(events.map(e=>frozen({...e})));
  },
 });
}
