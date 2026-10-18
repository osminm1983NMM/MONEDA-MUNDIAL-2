// Read-only, offline buy/sell research for unauthenticated visitors.
// No wallet, Supabase, blockchain, order, payment or exchange integration.
import {previewCoinTradeScenario,COIN_TRADE_SCENARIO_SIDES} from './digital-money/coin-market-demo.mjs';

export const GUEST_COIN_TRADE_REAL_FUNDS_ENABLED=false;
export const GUEST_COIN_TRADE_ORDERS_ENABLED=false;
const COPY=Object.freeze({
 es:Object.freeze({
  heading:'Simular compra o venta de Coin',
  warning:'SOLO EJEMPLO · NO EXISTEN COIN EMITIDAS NI PRECIOS OFICIALES',
  intro:'Escribe tú mismo una cantidad y un precio hipotético en USD. No se consulta ningún mercado.',
  buy:'Comprar (simulación)',sell:'Vender (simulación)',
  units:'Cantidad de Coin (ejemplo)',
  unitPrice:'Precio supuesto por Coin en USD',
  fee:'Comisión hipotética en puntos básicos (100 = 1 %; máximo 1000)',
  ready:'Escribe cantidades positivas válidas para ver el cálculo.',
  gross:'Valor bruto hipotético en USD',
  feeResult:'Comisión ilustrativa en USD',
  buyTotal:'Costo total hipotético del comprador en USD',
  sellNet:'Resultado hipotético del vendedor en USD',
  caveat:'Faltan spread, deslizamiento, impuestos, comisiones de red y costos de retiro. No se ha validado liquidez, conversión ni custodio.',
  blocked:'No se puede comprar, vender, retirar ni convertir Coin desde esta vista.',
  back:'Volver a Coin y Digital',
 }),
 en:Object.freeze({
  heading:'Explore hypothetical Coin buying and selling',
  warning:'EXAMPLE ONLY · NO COIN TOKENS OR OFFICIAL PRICES EXIST',
  intro:'Enter your own hypothetical quantity and USD price. No market is queried.',
  buy:'Buy (simulation)',sell:'Sell (simulation)',
  units:'Coin quantity (example)',
  unitPrice:'Assumed price per Coin in USD',
  fee:'Hypothetical fee in basis points (100 = 1%; maximum 1000)',
  ready:'Enter valid positive amounts to view the example.',
  gross:'Hypothetical gross value in USD',
  feeResult:'Illustrative fee in USD',
  buyTotal:'Hypothetical buyer cost in USD',
  sellNet:'Hypothetical seller proceeds in USD',
  caveat:'Spread, slippage, taxes, network fees and withdrawal costs are excluded. Liquidity, conversion and custody are unverified.',
  blocked:'You cannot buy, sell, withdraw or convert Coin from this screen.',
  back:'Back to Coin and Digital',
 }),
});
export function getGuestCoinTradePreview({language='es',side='buy',
 coinUnits='',coinUsdScenario='',feeBps='0'}={}){
 if(!COIN_TRADE_SCENARIO_SIDES.includes(side)||
  typeof coinUnits!=='string'||typeof coinUsdScenario!=='string'||
  typeof feeBps!=='string'||!/^(?:0|[1-9][0-9]{0,3})$/.test(feeBps))return null;
 const copy=COPY[language==='en'?'en':'es'];
 const scenario=previewCoinTradeScenario({
  side,coinUnits,coinUsdScenario,feeBps:Number(feeBps),
 });
 const quote=scenario?Object.freeze({
  grossUsd:scenario.hypotheticalGrossUsd,
  illustrativeFeeUsd:scenario.illustrativeFeeUsd,
  hypotheticalBuyerTotalUsd:scenario.hypotheticalBuyerTotalUsd,
  hypotheticalSellerProceedsUsd:scenario.hypotheticalSellerProceedsUsd,
  actualMarketQuote:false,orderCreated:false,canExecute:false,
 }):null;
 return Object.freeze({
  ...copy,side,quote,
  quoteSource:'manually_entered_unverified_scenario',
  requiresAccount:false,bankConnected:false,blockchainConnected:false,
  custodyConnected:false,tokenIssued:false,priceVerified:false,
  demoCreditsConvertible:false,canBuy:false,canSell:false,
  canWithdraw:false,canTransfer:false,realMoneyEnabled:false,
 });
}
