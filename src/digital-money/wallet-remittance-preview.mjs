// Investigación: previsualizar billetera → remesa sin transferir ni convertir activos.
import {quoteInternationalDemo, DEMO_CORRIDORS} from '../international-demo.mjs';
export const SOURCES=Object.freeze([
 {id:'demo_wallet',label:'Billetera MWD (créditos ficticios)'},
 {id:'digital_concept',label:'Moneda Mundial Digital (no emitida)'},
 {id:'coin_concept',label:'Moneda Mundial Coin (no emitida)'},
 {id:'external_usd_scenario',label:'Financiación externa USD (hipotética)'},
].map(Object.freeze));
export const PAYOUTS=Object.freeze([
 {id:'bank_account',label:'Cuenta bancaria'},{id:'payment_card',label:'Tarjeta receptora'},
 {id:'cash_pickup',label:'Agente pagador con código'},
].map(Object.freeze));
const causes=Object.freeze({
 demo_wallet:'Los MWD de prueba NO son dólares, ni saldo cobrable.',
 digital_concept:'Digital aún no tiene emisor, custodia, reserva ni redención aprobada.',
 coin_concept:'Coin aún no está emitida y no tiene precio o liquidez verificables.',
 external_usd_scenario:'Los USD son solo un ejemplo sin banco de origen conectado.',
});
const requirements=Object.freeze({
 bank_account:'Requiere proveedor de origen, banco receptor, validación y KYC/AML.',
 payment_card:'Requiere red y emisor/adquirente habilitados, verificación y liquidación.',
 cash_pickup:'Requiere agente autorizado, identidad y cobro único validado por servidor.',
});
export function previewWalletRemittance({
 source='demo_wallet',destination='NI',payout='cash_pickup',
 funding='bank',hypotheticalUsdCents=10000,
}={}){
 if(!Object.hasOwn(causes,source)||!Object.hasOwn(requirements,payout)||
 !['bank','card'].includes(funding)||!Number.isSafeInteger(hypotheticalUsdCents)||
 hypotheticalUsdCents<100||hypotheticalUsdCents>10000000)return null;
 const country=DEMO_CORRIDORS.find(x=>x.code===destination);
 if(!country)return null;
 // NUNCA valorar MWD, Coin ni Digital por el importe hipotético escrito.
 const q=source==='external_usd_scenario'?quoteInternationalDemo({
   destination,amountCents:hypotheticalUsdCents,method:funding}):null;
 if(source==='external_usd_scenario'&&!q)return null;
 return Object.freeze({
  kind:'non_executable_design',source,payout,origin:'US',destination,
  country:country.country,destinationCurrency:country.currency,
  blockReason:causes[source],requirements:requirements[payout],
  illustrativeUsdCents:q?.amountCents??null,
  illustrativeFeeCents:q?.feeCents??null,
  illustrativeTotalCents:q?.totalPayCents??null,
  illustrativeReceiveCents:q?.receiverAmountCents??null,
  fxRate:q?.fxRate??null,quoteSource:q?'hypothetical_offline_table':'none',
  walletDebitedCents:0,creditsHaveUsdValue:false,coinPriceKnown:false,
  digitalIssuerConfirmed:false,providerConnected:false,kycVerified:false,
  financialCorridorAuthorized:false,realPaymentsEnabled:false,
  canDebitWallet:false,canChargeCard:false,canSend:false,
  canIssueRedeemableCode:false,canDisburse:false,
 });
}
