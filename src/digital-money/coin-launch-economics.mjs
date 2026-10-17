// Moneda Mundial Coin — SOLO ESTUDIO ECONÓMICO DE LANZAMIENTO.
// Separa oferta máxima, tokens emitidos, circulación y liquidez hipotética.
// NO determina precio real, no crea pool, token ni contrato, no hace ventas,
// ni considera como respaldo los créditos MWD de la aplicación.
const POS_INT=/^[1-9][0-9]{0,17}$/;
const MICRO=1000000n;
const USD_MICRO_PER_CENT=10000n;
const value=(v)=>typeof v==='string'&&POS_INT.test(v)?BigInt(v):null;
const fmt=n=>{
 const whole=n/MICRO,fraction=(n%MICRO).toString().padStart(6,'0').replace(/0+$/,'');
 return whole.toString()+(fraction?'.'+fraction:'');
};

/**
 * Un AMM de reservas es SOLO uno de varios modelos de descubrimiento de precio.
 * En el ejemplo: quoteUsdCents / poolCoinUnits = precio inicial indicativo.
 * En realidad comisiones, decimales de tokens, concentración de liquidez,
 * arbitraje y cambios de demanda hacen que el precio real varíe.
 *
 * Cantidades de tokens hipotéticas enteras, no se decide el suministro oficial.
 * La capitalización es precio x tokens circulantes, NO ingresos del emisor.
 */
export function previewCoinLaunchEconomics({
 maximumSupplyUnits,initiallyMintedUnits,initiallyCirculatingUnits,
 poolCoinUnits,poolQuoteUsdCents,
}={}){
 const max=value(maximumSupplyUnits);
 const minted=value(initiallyMintedUnits);
 const circulation=value(initiallyCirculatingUnits);
 const coinsInPool=value(poolCoinUnits);
 const quoteCents=value(poolQuoteUsdCents);
 if([max,minted,circulation,coinsInPool,quoteCents].some(v=>v===null)||
  minted>max||circulation>minted||coinsInPool>circulation)return null;
 const priceMicro=quoteCents*USD_MICRO_PER_CENT/coinsInPool;
 if(priceMicro<=0n)return null; // no presentar como precio cero un ratio diminuto
 const circulatingValueMicro=circulation*priceMicro;
 const fullyDilutedValueMicro=max*priceMicro;
 const mintedValueMicro=minted*priceMicro;
 const floatingPercentBps=circulation*10000n/max;
 return Object.freeze({
  maximumSupplyUnits:max.toString(),
  initiallyMintedUnits:minted.toString(),
  initiallyCirculatingUnits:circulation.toString(),
  remainingUnmintedUnits:(max-minted).toString(),
  mintedNotCirculatingUnits:(minted-circulation).toString(),
  illustrativePoolCoinUnits:coinsInPool.toString(),
  illustrativePoolQuoteUsdCents:quoteCents.toString(),
  hypotheticalOpeningReferencePriceUsd:fmt(priceMicro),
  hypotheticalCirculatingValueUsd:fmt(circulatingValueMicro),
  hypotheticalFullyDilutedValuationUsd:fmt(fullyDilutedValueMicro),
  hypotheticalMintedValueUsd:fmt(mintedValueMicro),
  initialFloatPercentBps:floatingPercentBps.toString(),
  // Estas valoraciones NO son recaudación, liquidez convertible ni precio garantizado.
  launchPriceApproved:false,marketPriceKnown:false,officialSupplyChosen:false,
  liquidityProvided:false,poolDeployed:false,realStablecoinConfirmed:false,
  tokenIssued:false,marketTradingEnabled:false,canExecute:false,
  noGuaranteeOfLiquidity:true,noPromiseOfReturns:true,
  illustrativeOnly:true,assumptions:'hypothetical_pool_ratio_without_market_trading',
 });
}
