// Transparencia sobre costos y riesgos de un escenario de remesa, SOLO DEMO.
// Una tasa manual nunca es FX oficial ni un valor garantizado al beneficiario.
import {previewWalletRemittance,previewManualFxPayout} from './wallet-remittance-preview.mjs';
export function previewRemittanceDisclosure({
 destination='HN',source='external_usd_scenario',payout='bank_account',
 funding='bank',hypotheticalUsdCents=10000,manualLocalPerUsd='',
}={}){
 const base=previewWalletRemittance({destination,source,payout,funding,hypotheticalUsdCents});
 if(!base)return null;
 const isUsdScenario=source==='external_usd_scenario';
 const fx=isUsdScenario&&typeof manualLocalPerUsd==='string'&&manualLocalPerUsd.trim()
  ?previewManualFxPayout({destination,source,payout,funding,hypotheticalUsdCents,manualLocalPerUsd})
  :null;
 return Object.freeze({
  status:'unverified_educational_example',destination,payout,source,
  principalUsdCents:isUsdScenario?base.illustrativeUsdCents:null,
  hypotheticalServiceFeeUsdCents:isUsdScenario?base.illustrativeFeeCents:null,
  hypotheticalDisplayedTotalUsdCents:isUsdScenario?base.illustrativeTotalCents:null,
  sourceCurrency:'USD',destinationCurrency:base.destinationCurrency,
  // Solo ejemplo, la comisión no comprende necesariamente intermediarios,
  // impuestos, margen FX u otros importes.
  serviceFeeIsReal:false,totalCostComplete:false,
  intermediaryFeesKnown:false,cardFeesKnown:false,
  taxesKnown:false,fxSpreadKnown:false,fxProviderQuoteAvailable:false,
  recipientAmountCurrency:fx?.destinationCurrency??null,
  recipientAmountManualIllustration:fx?.illustrativeRecipientAmount??null,
  rateManuallyEnteredUnverified:fx?.manualLocalPerUsd??null,
  recipientAmountGuaranteed:false,customerDisclosureApproved:false,
  providerConnected:false,realPaymentsEnabled:false,
  canPay:false,canSend:false,canDebitWallet:false,
  warning:'Los importes son ejemplos independientes. Comisión, cambio, impuestos y total final NO son cotizaciones ni están completos.',
 });
}
