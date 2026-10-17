// MONEDA MUNDIAL COIN — impacto de precio en pool HIPOTÉTICO.
// Un pool de producto constante x*y=k es sólo un modelo educativo de un posible AMM.
// Nunca consulta un mercado, crea una orden, despliega un pool ni opera con dinero.
// Todas las cantidades son enteros ficticios (Coin y centavos USD).
const POS=/^[1-9][0-9]{0,17}$/;
const PRICE_SCALE=1000000n; // centavos -> USD a 8 decimales
const ZERO='0';
const AMM_SIDES=Object.freeze(['buy_coin','sell_coin']);
const parse=value=>typeof value==='string'&&POS.test(value)?BigInt(value):null;
const fmtPrice=(x,y)=>{
 const scaled=y*PRICE_SCALE/x;
 const decimal=(scaled%100000000n).toString().padStart(8,'0').replace(/0+$/,'');
 return (scaled/100000000n).toString()+(decimal?'.'+decimal:'');
};
export const AMM_RESEARCH_SIDES=AMM_SIDES;

export function previewCoinPoolImpact({
 poolCoinUnits,poolQuoteUsdCents,side,tradeInputUnits,feeBps=0,
}={}) {
 const coins=parse(poolCoinUnits),quote=parse(poolQuoteUsdCents);
 const input=parse(tradeInputUnits);
 if(coins===null||quote===null||input===null||
  !AMM_SIDES.includes(side)||!Number.isSafeInteger(feeBps)||
  feeBps<0||feeBps>1000) return null;
 if(coins<2n||quote<2n)return null;
 // La comisión se redondea hacia arriba para no sobreestimar el resultado.
 const fee=(input*BigInt(feeBps)+9999n)/10000n;
 const effective=input-fee;
 if(effective<=0n)return null;
 let endingCoin,endingQuote,output;
 if(side==='buy_coin'){
  output=coins*effective/(quote+effective);
  if(output<=0n||output>=coins)return null;
  endingCoin=coins-output;
  endingQuote=quote+input;
 }else{
  output=quote*effective/(coins+effective);
  if(output<=0n||output>=quote)return null;
  endingCoin=coins+input;
  endingQuote=quote-output;
 }
 // Sin swaps encadenados: cada llamada es un escenario independiente.
 const initial=fmtPrice(coins,quote);
 const final=fmtPrice(endingCoin,endingQuote);
 if((side==='buy_coin'&&!(endingQuote*coins>quote*endingCoin))||
    (side==='sell_coin'&&!(endingQuote*coins<quote*endingCoin)))return null;
 return Object.freeze({
  side,feeBps,
  poolCoinUnits:coins.toString(),
  poolQuoteUsdCents:quote.toString(),
  tradeInputUnits:input.toString(),
  feeInputUnits:fee.toString(),
  effectiveTradeInputUnits:effective.toString(),
  hypotheticalOutputUnits:output.toString(),
  endingPoolCoinUnits:endingCoin.toString(),
  endingPoolQuoteUsdCents:endingQuote.toString(),
  initialSpotPriceUsd:initial,
  hypotheticalAfterTradeSpotPriceUsd:final,
  quoteSource:'imaginary_constant_product_pool',
  gasFeesIncluded:false,externalPriceKnown:false,
  actualTradingVenueSelected:false,liquidityGuaranteed:false,
  networkDeployed:false,tokenIssued:false,
  poolDeployed:false,quoteExecutable:false,
  buyEnabled:false,sellEnabled:false,realMoneyEnabled:false,
  status:'education_only',
 });
}
