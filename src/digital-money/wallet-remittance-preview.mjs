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


/**
 * Cuánto recibiría una persona en un ESCENARIO MANUAL de divisas.
 * Jamás es una cotización o promesa de entrega de un banco.
 * El USD de envío es una cantidad introducida y ficticia; no se debita saldo.
 */
const MANUAL_RATE=/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,6})?$/;
const MINOR_DIGITS=Object.freeze({CLP:0,PYG:0});
function decimalToScaled(value){
 if(typeof value!=='string')return null;
 const v=value.trim().replace(',','.');
 if(!MANUAL_RATE.test(v))return null;
 const [integer,fraction='']=v.split('.');
 const scaled=BigInt(integer)*1000000n+BigInt(fraction.padEnd(6,'0')||'0');
 return scaled>0n?scaled:null;
}
function minorToString(minor,decimals){
 if(decimals===0)return minor.toString();
 const base=10n**BigInt(decimals);
 return (minor/base).toString()+'.'+(minor%base).toString().padStart(decimals,'0');
}
export function previewManualFxPayout({
 source='external_usd_scenario',destination='HN',payout='cash_pickup',
 funding='bank',hypotheticalUsdCents=10000,manualLocalPerUsd,
}={}){
 // No asignar tipo de cambio a MWD, Coin o Digital: NO son dinero real.
 if(source!=='external_usd_scenario')return null;
 const base=previewWalletRemittance({source,destination,payout,funding,hypotheticalUsdCents});
 if(!base||base.destinationCurrency==='USD')return null;
 const scaled=decimalToScaled(manualLocalPerUsd);
 if(scaled===null)return null;
 const minorDigits=MINOR_DIGITS[base.destinationCurrency]??2;
 // Envío en centavos USD -> moneda local; redondeo hacia abajo por prudencia.
 const minor=(BigInt(base.illustrativeUsdCents)*scaled*
              (10n**BigInt(minorDigits)))/(100n*1000000n);
 if(minor<=0n||minor>1000000000000000n)return null;
 return Object.freeze({
  origin:base.origin,destination:base.destination,
  sourceCurrency:'USD',destinationCurrency:base.destinationCurrency,
  exampleSourceAmountCents:base.illustrativeUsdCents,
  exampleFeeCents:base.illustrativeFeeCents,
  exampleTotalPayCents:base.illustrativeTotalCents,
  manualLocalPerUsd:manualLocalPerUsd.trim().replace(',','.'),
  illustrativeRecipientAmount:minorToString(minor,minorDigits),
  destinationMinorDigits:minorDigits,
  quoteSource:'unverified_manual_example_only',
  fxRateVerified:false,providerConnected:false,
  recipientAmountGuaranteed:false,bankSettlementConfirmed:false,
  feeComplete:false,taxesIncluded:false,
  demoBalanceUsed:false,cryptoConverted:false,
  canSend:false,canDebitWallet:false,canDisburse:false,
  realPaymentsEnabled:false,status:'illustrative_not_executable',
 });
}
