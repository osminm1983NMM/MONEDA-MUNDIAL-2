// Moneda Mundial Digital, Opción C — únicamente diseño y comparación ilustrativa.
// NUNCA emitir, vender, acuñar, cotizar oficialmente ni custodiar activos.
export const DIGITAL_ASSET_DESIGNS = Object.freeze([
  Object.freeze({
    id:'demo_mwd_credits',label:'MWD de prueba (actual)',
    category:'demo_only',isCrypto:false,
    marketPriceUsd:null,supply:null,canBuy:false,canSell:false,canSpendReal:false,
  }),
  Object.freeze({
    id:'moneda_mundial_digital_concept',label:'Moneda Mundial Digital (estable; concepto)',
    category:'third_party_regulated_stablecoin_candidate',isCrypto:true,
    marketPriceUsd:null,issuerSelected:false,redeemable:false,canBuy:false,canSell:false,canSpendReal:false,
  }),
  Object.freeze({
    id:'mwd_coin_concept',label:'Moneda Mundial Coin (concepto)',
    category:'variable_price_crypto_candidate',isCrypto:true,
    marketPriceUsd:null,supply:null,blockchainSelected:false,
    canMint:false,canBuy:false,canSell:false,canSpendReal:false,
  }),
]);

// El supuesto valor de mercado variable NO se establece desde la aplicación.
// No existe una criptomoneda MWD Coin emitida, ni un ticker verificado.
export function assessDigitalMoneyDesign(){
  return Object.freeze({
    stablecoinIssuerApproved:false,
    variableTokenIssued:false,variableTokenPriceUsd:null,variableTokenSupply:null,
    buyEnabled:false,sellEnabled:false,realTransferEnabled:false,redeemEnabled:false,
    ledgerLinkedToDemoWallet:false,
    status:'research_and_demo_only',
  });
}

function positiveDecimal(value, max, maxFraction=6){
  if (typeof value !== 'string') return null;
  const s=value.trim().replace(',','.');
  const regex=new RegExp('^(?:0|[1-9]\\d{0,8})(?:\\.\\d{1,'+maxFraction+'})?$');
  if(!regex.test(s))return null;
  const n=Number(s);
  return Number.isFinite(n)&&n>0&&n<=max?n:null;
}

// Los centavos y la razón moneda local/USD se calculan con enteros: así se
// evitan errores de punto flotante en el redondeo de la referencia ilustrativa.
function toScaledChecked(value,decimals) {
 const [whole,frac='']=value.trim().replace(',','.').split('.');
 const scale=10n**BigInt(decimals);
 return BigInt(whole)*scale+BigInt(frac.padEnd(decimals,'0')||'0');
}
const roundPositive=(numerator,denominator)=>
 (numerator+denominator/2n)/denominator;

/**
 * Únicamente comparación manual educativa, sin tasa FX de proveedor, precio
 * cripto de mercado, garantía de ahorro ni ejecución de pagos.
 * localUnitsPerUsd: por ejemplo "PEN por USD" introducidos manualmente.
 * sellerUsd: lo que el vendedor AFIRMA que cuesta en USD.
 * tokenUsdExample: opcional, valor arbitrario de escenario y NO cotización MWD.
 */
export function compareInternationalPriceDemo({
  localCurrency='PEN',localPrice,localUnitsPerUsd,sellerUsd,
  tokenUsdExample=null,
}={}){
  if(!/^[A-Z]{3}$/.test(localCurrency) || localCurrency==='USD')return null;
  const price=positiveDecimal(localPrice,1_000_000,2);
  const rate=positiveDecimal(localUnitsPerUsd,1_000_000,6);
  const seller=positiveDecimal(sellerUsd,1_000_000,2);
  if(price===null||rate===null||seller===null)return null;

  // price tiene dos decimales y rate seis. Ambos son positivos y validados.
  const referenceMinor=roundPositive(
    toScaledChecked(localPrice,2)*1_000_000n,
    toScaledChecked(localUnitsPerUsd,6)
  );
  if(referenceMinor<=0n||referenceMinor>100_000_000n)return null;
  const referenceCents=Number(referenceMinor);
  const sellerCents=Number(toScaledChecked(sellerUsd,2));
  const differenceCents=sellerCents-referenceCents;
  // Todo resultado de la calculadora carece de tasa verificable, consentimiento,
  // tarifas reales, impuestos, fuente FX y autorización bancaria.
  const token=tokenUsdExample===null||tokenUsdExample===''?null:
     positiveDecimal(tokenUsdExample,1_000_000,6);
  if(tokenUsdExample!==null&&tokenUsdExample!==''&&token===null)return null;
  const tokenMicros=token===null?null:toScaledChecked(tokenUsdExample,6);
  // Coin hipotéticas: USD centavos -> USD -> unidades Coin con seis decimales.
  const coinMicros=tokenMicros===null?null:
    roundPositive(referenceMinor*1_000_000_000_000n,100n*tokenMicros);
  if(coinMicros!==null&&coinMicros>1_000_000_000_000_000n)return null;
  const possibleUnits=coinMicros===null?null:Number(coinMicros)/1_000_000;
  return Object.freeze({
    localCurrency,localPrice:price,localUnitsPerUsd:rate,
    sellerUsdCents:sellerCents,referenceUsdCents:referenceCents,
    differenceUsdCents:differenceCents,
    hypotheticalCoinUsdPrice:token,
    hypotheticalCoinUnits:possibleUnits,
    quoteSource:'manual_unverified_illustrative',
    exchangeRateVerified:false,marketPriceVerified:false,
    stablecoinQuoteAvailable:false,
    actualFeeCents:null,actualTaxCents:null,totalToPayCents:null,
    guaranteedSavingsCents:null,merchantAccepted:false,
    canBuyTokens:false,canSendMoney:false,canIssueCoin:false,
  });
}
