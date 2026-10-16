// MONEDA MUNDIAL DIGITAL (concepto estable) ⇄ MONEDA MUNDIAL COIN (concepto variable).
// Comparador EXCLUSIVAMENTE MATEMÁTICO y manual. No conecta exchanges, bancos,
// pools de liquidez, billeteras, contratos, APIs ni proveedores de stablecoins.
// No presupone que exista una stablecoin de Moneda Mundial o que valga USD 1.
export const ASSET_CONCEPTS=Object.freeze({
  coin:Object.freeze({id:'moneda_mundial_coin',name:'Moneda Mundial Coin',
    behavior:'variable_market_price',symbol:null,issuerApproved:false,
    tokenIssued:false,walletEnabled:false}),
  digital:Object.freeze({id:'moneda_mundial_digital',name:'Moneda Mundial Digital',
    behavior:'stable_payment_concept',symbol:null,issuerApproved:false,
    tokenIssued:false,walletEnabled:false,redemptionEnabled:false}),
});
const SCALE=1000000n;
function readSixDecimal(value,{allowZero=false}={}){
 if(typeof value!=='string'||! /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value.trim()))return null;
 const [whole,fraction='']=value.trim().split('.');
 const scaled=BigInt(whole)*SCALE+BigInt(fraction.padEnd(6,'0')||'0');
 return scaled===0n&&!allowZero?null:scaled;
}
function formatSix(scaled){
 const neg=scaled<0n;const n=neg?-scaled:scaled;
 const whole=n/SCALE,frac=(n%SCALE).toString().padStart(6,'0').replace(/0+$/,'');
 return (neg?'-':'')+whole.toString()+(frac?'.'+frac:'');
}

/**
 * ESCENARIO MANUAL: cuántas unidades de Moneda Mundial Digital se recibirían
 * si Coin y Digital tuvieran los precios USD escritos por el usuario.
 * No hay precio mercado, cotización ejecutable, tipo de cambio ni garantía.
 */
export function previewCoinToDigitalScenario({
 coinUnits,coinUsdScenario,digitalUsdScenario,feeBps=0,slippageBps=0,
}={}){
 const quantity=readSixDecimal(coinUnits);
 const coinPrice=readSixDecimal(coinUsdScenario);
 const digitalPrice=readSixDecimal(digitalUsdScenario);
 if(quantity===null||coinPrice===null||digitalPrice===null||
    !Number.isInteger(feeBps)||feeBps<0||feeBps>1000||
    !Number.isInteger(slippageBps)||slippageBps<0||slippageBps>500)return null;
 // BigInt avoids floating-point inaccuracies and rounds down the output.
 const hypotheticalUsdMicro=quantity*coinPrice/SCALE;
 const hypotheticalGrossDigital= hypotheticalUsdMicro*SCALE/digitalPrice;
 if(hypotheticalGrossDigital<=0n)return null;
 // Fee: round up to avoid overstating units. Slippage allowance is a risk
 // sensitivity, not a guaranteed minimum receive.
 const illustrativeFee=(hypotheticalGrossDigital*BigInt(feeBps)+9999n)/10000n;
 const net=hypotheticalGrossDigital-illustrativeFee;
 if(net<=0n)return null;
 const stressNet=net*BigInt(10000-slippageBps)/10000n;
 return Object.freeze({
  from:'moneda_mundial_coin',to:'moneda_mundial_digital',
  inputCoinUnits:formatSix(quantity),coinUsdScenario:formatSix(coinPrice),
  digitalUsdScenario:formatSix(digitalPrice),
  hypotheticalUsdValue:formatSix(hypotheticalUsdMicro),
  hypotheticalGrossDigitalUnits:formatSix(hypotheticalGrossDigital),
  illustrativeFeeDigitalUnits:formatSix(illustrativeFee),
  hypotheticalNetDigitalUnits:formatSix(net),
  slippageRiskBps:slippageBps,
  hypotheticalStressDigitalUnits:formatSix(stressNet),
  gasFeesIncluded:false,networkFeesIncluded:false,
  quoteSource:'user_entered_unverified_scenarios',
  realMarketPriceKnown:false,stablecoinIssuerSelected:false,
  tradingVenueSelected:false,liquidityConfirmed:false,
  priceGuaranteed:false,minimumReceiveGuaranteed:false,
  assetCustodyEnabled:false,realTransferEnabled:false,
  canExecute:false,canBuy:false,canSell:false,canRedeem:false,
  status:'educational_only',
 });
}
