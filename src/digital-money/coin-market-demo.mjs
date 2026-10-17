// Escenario educativo de compra o venta hipotética de Moneda Mundial Coin.
// No se realiza compra, venta, depósito, retiro, orden, cotización o conexión a exchange.
// Cantidades y precios manuales. Créditos MWD DEMO jamás sirven de fondeo.
const SIX=1000000n, MAX_BPS=1000;
function decimalSix(value) {
 if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/.test(value))return null;
 const [whole,frac='']=value.split('.');
 const n=BigInt(whole)*SIX+BigInt(frac.padEnd(6,'0')||'0');
 return n>0n?n:null;
}
function fmt(n){
 const whole=n/SIX,frac=(n%SIX).toString().padStart(6,'0').replace(/0+$/,'');
 return whole.toString()+(frac?'.'+frac:'');
}
export const COIN_TRADE_SCENARIO_SIDES=Object.freeze(['buy','sell']);
export function previewCoinTradeScenario({
 side,coinUnits,coinUsdScenario,feeBps=0,
}={}) {
 if(!COIN_TRADE_SCENARIO_SIDES.includes(side)||
    !Number.isSafeInteger(feeBps)||feeBps<0||feeBps>MAX_BPS)return null;
 const qty=decimalSix(coinUnits),unitPrice=decimalSix(coinUsdScenario);
 if(qty===null||unitPrice===null)return null;
 // Truncamiento hacia abajo: resultados ilustrativos, no precisión de mercado.
 const gross=qty*unitPrice/SIX;
 if(gross<=0n)return null;
 const fee=(gross*BigInt(feeBps)+9999n)/10000n;
 const net=gross-fee;
 if(side==='sell'&&net<=0n)return null;
 const total=gross+fee;
 return Object.freeze({
  asset:'moneda_mundial_coin',
  side,
  coinUnits:fmt(qty),
  manuallyEnteredCoinUsdScenario:fmt(unitPrice),
  hypotheticalGrossUsd:fmt(gross),
  illustrativeFeeUsd:fmt(fee),
  hypotheticalBuyerTotalUsd:side==='buy'?fmt(total):null,
  hypotheticalSellerProceedsUsd:side==='sell'?fmt(net):null,
  feeBps,
  // Sin cuenta custodiada, red, token, contraparte ni precio verificables.
  tradingVenueConnected:false,
  orderCreated:false,
  marketPriceVerified:false,liquidityConfirmed:false,
  networkFeesIncluded:false,spreadIncluded:false,taxesIncluded:false,
  currencyConversionIncluded:false,bankSettlementConfirmed:false,
  coinIssued:false,demoCreditsSpendable:false,
  canBuy:false,canSell:false,canWithdraw:false,canTransfer:false,
  executable:false,realMoneyEnabled:false,
  status:'educational_research_only',
 });
}
