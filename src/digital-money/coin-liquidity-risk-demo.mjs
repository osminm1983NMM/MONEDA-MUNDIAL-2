// MONEDA MUNDIAL COIN — tensión de liquidez AMM en escenario NO EJECUTABLE.
// Sin moneda emitida, mercado, contrato, banco, oracle, exchange ni dinero real.
// No estabiliza el precio ni crea órdenes, reservas, compras o ventas.
// Aritmética exacta BigInt; entradas son enteros sintéticos.
import {previewCoinPoolImpact} from './coin-pool-impact-demo.mjs';

const POS=/^[1-9][0-9]{0,17}$/;
const NONNEG=/^(0|[1-9][0-9]{0,17})$/;
const MAX_UINT=999999999999999999n;
const FIELDS=['maximumSupplyUnits','circulatingCoinUnits','poolCoinUnits',
 'poolQuoteUsdCents','sellCoinUnits','poolFeeBps',
 'maxAllowedShortfallBps','minimumReceiveUsdCents'];
const frozen=x=>Object.freeze(x);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const exact=(x,fields)=>plain(x)&&
  Object.keys(x).sort().join('|')===fields.slice().sort().join('|');
const readPositive=x=>typeof x==='string'&&POS.test(x)&&BigInt(x)<=MAX_UINT?BigInt(x):null;
const readNonnegative=x=>typeof x==='string'&&NONNEG.test(x)&&BigInt(x)<=MAX_UINT?BigInt(x):null;
const ceilDiv=(a,b)=>(a+b-1n)/b;
const ratioBps=(n,d)=>d>0n?(n*10000n)/d:null;

function validate(input){
 if(!exact(input,FIELDS))return null;
 const max=readPositive(input.maximumSupplyUnits);
 const circulating=readPositive(input.circulatingCoinUnits);
 const coin=readPositive(input.poolCoinUnits);
 const quote=readPositive(input.poolQuoteUsdCents);
 const sell=readPositive(input.sellCoinUnits);
 const minimum=readNonnegative(input.minimumReceiveUsdCents);
 const fee=input.poolFeeBps,limit=input.maxAllowedShortfallBps;
 if([max,circulating,coin,quote,sell].some(x=>x===null)||
  minimum===null||circulating>max||coin>circulating||coin<2n||
  quote<2n||sell>circulating||
  !Number.isSafeInteger(fee)||fee<0||fee>1000||
  !Number.isSafeInteger(limit)||limit<0||limit>10000)return null;
 return {max,circulating,coin,quote,sell,minimum,fee,limit};
}

/**
 * La cantidad que vendería el usuario se compara con un pool ficticio x*y=k.
 * El "precio" inicial es quote/coin; NO existe cotización ni contraparte.
 * El impacto de precio no es el deslizamiento real ni una predicción.
 *
 * El cálculo permite señalar si los resultados IMAGINARIOS incumplen los
 * límites de protección elegidos; nunca puede aprobar operaciones reales.
 */
export function previewCoinLiquidityRisk(input={}){
 const v=validate(input);
 if(!v)return null;
 const output=previewCoinPoolImpact({
  poolCoinUnits:v.coin.toString(),
  poolQuoteUsdCents:v.quote.toString(),
  side:'sell_coin',tradeInputUnits:v.sell.toString(),feeBps:v.fee,
 });
 if(!output)return null;
 const received=BigInt(output.hypotheticalOutputUnits);
 const theoreticalSpotGross=(v.sell*v.quote)/v.coin;
 if(theoreticalSpotGross<=0n||received<=0n||received>theoreticalSpotGross)return null;
 const grossShortfall=theoreticalSpotGross-received;
 // Redondeo al alza de la diferencia protege de pasar riesgos limítrofes.
 const shortfallBps=ceilDiv(grossShortfall*10000n,theoreticalSpotGross);
 const hypotheticalCap=(v.circulating*v.quote)/v.coin;
 if(hypotheticalCap<=0n)return null;
 const quoteVsCapBps=ratioBps(v.quote,hypotheticalCap);
 const afterQuote=BigInt(output.endingPoolQuoteUsdCents);
 const depletedBps=ratioBps(v.quote-afterQuote,v.quote);
 const maxShortfallBreached=shortfallBps>BigInt(v.limit);
 const minimumProceedsBreached=received<v.minimum;
 const warnings=[];
 if(maxShortfallBreached)warnings.push('simulated_shortfall_exceeds_customer_limit');
 if(minimumProceedsBreached)warnings.push('simulated_net_below_customer_minimum');
 if(BigInt(output.hypotheticalSpotPriceChangeBps)>500n)
   warnings.push('large_hypothetical_spot_price_movement');
 if(depletedBps>=2000n)
   warnings.push('large_fraction_of_pool_quote_reserves_used');
 if(v.coin*10000n/v.circulating<500n)
   warnings.push('pool_coin_share_of_circulation_below_five_percent');
 return frozen({
  status:'liquidity_research_only',side:'sell_coin',
  hypotheticalMaximumSupplyUnits:v.max.toString(),
  hypotheticalCirculatingCoinUnits:v.circulating.toString(),
  hypotheticalPoolCoinUnits:v.coin.toString(),
  hypotheticalPoolQuoteUsdCents:v.quote.toString(),
  hypotheticalSellCoinUnits:v.sell.toString(),
  hypotheticalSpotReferenceUsd:output.initialSpotPriceUsd,
  hypotheticalAfterSaleSpotUsd:output.hypotheticalAfterTradeSpotPriceUsd,
  hypotheticalSpotValueUsdCents:theoreticalSpotGross.toString(),
  hypotheticalReceiveUsdCents:received.toString(),
  hypotheticalGrossShortfallUsdCents:grossShortfall.toString(),
  hypotheticalShortfallBps:shortfallBps.toString(),
  hypotheticalSpotPriceChangeBps:output.hypotheticalSpotPriceChangeBps,
  hypotheticalPoolFeeCoinUnits:output.feeInputUnits,
  hypotheticalPoolQuoteRemainingCents:afterQuote.toString(),
  hypotheticalQuoteReserveDrawdownBps:depletedBps.toString(),
  hypotheticalCirculatingMarketCapUsdCents:hypotheticalCap.toString(),
  hypotheticalPoolQuoteToMarketCapBps:quoteVsCapBps.toString(),
  customerMinReceiveUsdCents:v.minimum.toString(),
  customerMaxAllowedShortfallBps:v.limit,
  illustrativeLimitBreached:maxShortfallBreached||minimumProceedsBreached,
  warnings:frozen(warnings),
  // Un "aprobado" de esta simulación JAMÁS permite pasar a producción.
  quoteExecutable:false,realMarketPriceVerified:false,
  realLiquidityVerified:false,issuerHasBuybackObligation:false,
  companyPriceSupportPromised:false,returnsGuaranteed:false,
  priceStabilizationEnabled:false,networkFeesKnown:false,
  slippageGuaranteeProvided:false,stablecoinIssued:false,
  tokenIssued:false,customerFundsHeld:false,canTrade:false,
  realMoneyEnabled:false,
 });
}

/**
 * Choques INDEPENDIENTES de venta del 1/5/10/25% de la circulación
 * contra el MISMO pool base, sin sumarlos secuencialmente.
 * No son pronósticos; representan riesgos de profundidad de mercado.
 */
export function previewCoinLiquidityStress({
 maximumSupplyUnits,circulatingCoinUnits,poolCoinUnits,
 poolQuoteUsdCents,poolFeeBps=0,maxAllowedShortfallBps=500,
 minimumReceiveUsdCents='0',sellSharesBps=[100,500,1000,2500],
}={}){
 const circulating=readPositive(circulatingCoinUnits);
 if(circulating===null||!Array.isArray(sellSharesBps)||
   sellSharesBps.length<1||sellSharesBps.length>8||
   sellSharesBps.some(x=>!Number.isSafeInteger(x)||x<1||x>10000)||
   new Set(sellSharesBps).size!==sellSharesBps.length)return null;
 const results=[];
 for(const share of sellSharesBps){
  const hypotheticalSell=ceilDiv(circulating*BigInt(share),10000n);
  const r=previewCoinLiquidityRisk({
   maximumSupplyUnits,circulatingCoinUnits,poolCoinUnits,
   poolQuoteUsdCents,poolFeeBps,maxAllowedShortfallBps,
   minimumReceiveUsdCents,sellCoinUnits:hypotheticalSell.toString(),
  });
  results.push(frozen({
   hypotheticalCirculatingSellShareBps:share,
   hypotheticalSellCoinUnits:hypotheticalSell.toString(),
   modeled:r!==null,
   hypotheticalReceiveUsdCents:r?.hypotheticalReceiveUsdCents??null,
   hypotheticalShortfallBps:r?.hypotheticalShortfallBps??null,
   hypotheticalPostTradeSpotPriceUsd:r?.hypotheticalAfterSaleSpotUsd??null,
   warnings:r?.warnings??frozen(['scenario_not_modelable']),
   realMoneyEnabled:false,
  }));
 }
 return frozen({
  status:'independent_liquidity_stress_examples_only',
  results:frozen(results),
  simulationsIndependent:true,scenariosNotCombined:true,
  noMarketPriceForecast:true,noPriceFloorGuaranteed:true,
  noCompanyBuybackPromised:true,
  noTokensIssued:true,realMoneyEnabled:false,canTrade:false,
 });
}
