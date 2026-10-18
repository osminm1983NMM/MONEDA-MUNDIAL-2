// Moneda Mundial 2.0 — recorrido integral de lectura, no ejecutable.
// Unifica la explicación de billetera, Coin→Digital, remesa y entrega.
// NO crea operación, NO consulta Supabase, blockchain, bancos ni saldo real.
import {previewWalletRemittance,previewManualFxPayout} from './wallet-remittance-preview.mjs';
import {previewCoinToDigitalScenario,previewDigitalToCoinScenario} from './coin-to-digital-design.mjs';

const SOURCES=new Set(['demo_wallet','coin_concept','digital_concept','external_usd_scenario']);
const STEP_LABELS=Object.freeze([
 Object.freeze({id:'source',title:'1. Billetera o financiación',status:'concept_or_demo_only'}),
 Object.freeze({id:'conversion',title:'2. Conversión de activos',status:'not_available'}),
 Object.freeze({id:'transfer',title:'3. Transferencia internacional',status:'not_available'}),
 Object.freeze({id:'delivery',title:'4. Entrega al beneficiario',status:'not_available'}),
]);

export function previewFullMoneyJourney({
 source='coin_concept',destination='HN',payout='cash_pickup',funding='bank',
 hypotheticalUsdCents=10000,coinUnits='10',digitalUnits='2.5',coinUsdScenario='0.25',
 digitalUsdScenario='1',manualLocalPerUsd='',feeBps=0,slippageBps=0,
}={}){
 if(!SOURCES.has(source))return null;
 const remittance=previewWalletRemittance({
  source,destination,payout,funding,hypotheticalUsdCents,
 });
 if(!remittance)return null;
 // Estos ejemplos se calculan por separado. JAMÁS encadenar el resultado
 // de Coin como fondos disponibles en Digital, USD o una remesa.
 const conversion=source==='coin_concept'
  ?previewCoinToDigitalScenario({coinUnits,coinUsdScenario,digitalUsdScenario,feeBps,slippageBps})
  :null;
 // Separate inverse example: never treat hypothetical Digital units as usable Coin,
 // USD balance or remittance funding.
 const reverseConversion=source==='digital_concept'
  ?previewDigitalToCoinScenario({digitalUnits,coinUsdScenario,digitalUsdScenario,feeBps,slippageBps})
  :null;
 const fx=source==='external_usd_scenario'&&manualLocalPerUsd!==''?
  previewManualFxPayout({
   source,destination,payout,funding,hypotheticalUsdCents,manualLocalPerUsd,
  }):null;
 return Object.freeze({
  mode:'educational_read_only',origin:'US',destination,
  source,payout,destinationCurrency:remittance.destinationCurrency,
  steps:STEP_LABELS,
  blockReason:remittance.blockReason,
  conversionExample:conversion?Object.freeze({
   inputCoinUnits:conversion.inputCoinUnits,
   hypotheticalDigitalUnits:conversion.hypotheticalNetDigitalUnits,
   grossDigitalUnits:conversion.hypotheticalGrossDigitalUnits,
   illustrativeFeeDigitalUnits:conversion.illustrativeFeeDigitalUnits,
   riskAdjustedDigitalUnits:conversion.hypotheticalStressDigitalUnits,
   slippageRiskBps:conversion.slippageRiskBps,
   isGuaranteedMinimum:false,
   externalNetworkCostsIncluded:false,
   coinPriceSource:'user_entered_unverified_scenario',
   digitalPriceSource:'user_entered_unverified_scenario',
   canExecute:false,
  }):null,
  inverseConversionExample:reverseConversion?Object.freeze({
   inputDigitalUnits:reverseConversion.inputDigitalUnits,
   hypotheticalCoinUnits:reverseConversion.hypotheticalNetCoinUnits,
   grossCoinUnits:reverseConversion.hypotheticalGrossCoinUnits,
   illustrativeFeeCoinUnits:reverseConversion.illustrativeFeeCoinUnits,
   riskAdjustedCoinUnits:reverseConversion.hypotheticalStressCoinUnits,
   slippageRiskBps:reverseConversion.slippageRiskBps,
   isGuaranteedMinimum:false,
   externalNetworkCostsIncluded:false,
   coinPriceSource:'user_entered_unverified_scenario',
   digitalPriceSource:'user_entered_unverified_scenario',
   canExecute:false,
  }):null,
  // Exclusivamente USD externo hipotético. Coin/Digital/MWD no se valoran
  // ni transfieren a partir de cálculos educativos.
  independentUsdExample:source==='external_usd_scenario'
   ?Object.freeze({amountCents:remittance.illustrativeUsdCents,
    feeCents:remittance.illustrativeFeeCents,
    totalCents:remittance.illustrativeTotalCents}):null,
  localCurrencyExample:fx?Object.freeze({
   amount:fx.illustrativeRecipientAmount,currency:fx.destinationCurrency,
   rateSource:'user_entered_unverified_scenario',guaranteed:false,
  }):null,
  // Ningún paso permite operaciones ni puede marcar etapas como cumplidas.
  walletBalanceRead:false,demoCreditsConvertible:false,
  coinIssued:false,digitalIssued:false,
  registeredPayoutAgentConnected:false,realFxQuoteAvailable:false,
  canTrade:false,canConvert:false,canDebit:false,canSend:false,
  canPayMerchant:false,canWithdraw:false,canDisburse:false,
  operational:false,realMoneyEnabled:false,
 });
}
