// Escenarios de OFERTA de Moneda Mundial Coin, didácticos y sin precio oficial.
// No hay token emitido, pool creado, promesa de rentabilidad ni cotización real.
import {previewCoinLaunchEconomics} from './coin-launch-economics.mjs';

export const COIN_LAUNCH_EXAMPLES=Object.freeze([
 Object.freeze({
  id:'100m',label:'Ejemplo A · 100 millones de Coin',
  parameters:Object.freeze({
   maximumSupplyUnits:'100000000',initiallyMintedUnits:'100000000',
   initiallyCirculatingUnits:'20000000',poolCoinUnits:'100000',
   poolQuoteUsd:'10000.00',
  }),
 }),
 Object.freeze({
  id:'1000m',label:'Ejemplo B · 1,000 millones de Coin',
  parameters:Object.freeze({
   maximumSupplyUnits:'1000000000',initiallyMintedUnits:'1000000000',
   initiallyCirculatingUnits:'200000000',poolCoinUnits:'1000000',
   poolQuoteUsd:'10000.00',
  }),
 }),
]);
const US_DOLLARS=/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/;

export function previewCoinLaunchFromDollars(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input)||
  Object.keys(input).some(k=>![
   'maximumSupplyUnits','initiallyMintedUnits','initiallyCirculatingUnits',
   'poolCoinUnits','poolQuoteUsd',
  ].includes(k)))return null;
 const amount=input.poolQuoteUsd;
 if(typeof amount!=='string'||!US_DOLLARS.test(amount))return null;
 const [whole,part='']=amount.split('.');
 const cents=BigInt(whole)*100n+BigInt(part.padEnd(2,'0')||'0');
 if(cents<=0n)return null;
 const estimate=previewCoinLaunchEconomics({
  maximumSupplyUnits:input.maximumSupplyUnits,
  initiallyMintedUnits:input.initiallyMintedUnits,
  initiallyCirculatingUnits:input.initiallyCirculatingUnits,
  poolCoinUnits:input.poolCoinUnits,
  poolQuoteUsdCents:cents.toString(),
 });
 if(!estimate)return null;
 return Object.freeze({
  ...estimate,poolQuoteUsdScenario:amount,
  model:'simple_pool_ratio_hypothetical_only',
  circulatingValueIsNotCash:true,
  fairMarketPriceDetermined:false,liquidityAvailableForRedemption:false,
 });
}
export function getCoinLaunchExample(id) {
 const found=COIN_LAUNCH_EXAMPLES.find(row=>row.id===id);
 return found?Object.freeze({...found.parameters}):null;
}
