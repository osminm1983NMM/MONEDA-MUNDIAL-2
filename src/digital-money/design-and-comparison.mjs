// Moneda Mundial Digital, Opción C — únicamente diseño y comparación ilustrativa.
// NUNCA emitir, vender, acuñar, cotizar oficialmente ni custodiar activos.
export const DIGITAL_ASSET_DESIGNS = Object.freeze([
  Object.freeze({
    id:'demo_mwd_credits',label:'MWD de prueba (actual)',
    category:'demo_only',isCrypto:false,
    marketPriceUsd:null,supply:null,canBuy:false,canSell:false,canSpendReal:false,
  }),
  Object.freeze({
    id:'stable_payment_concept',label:'Pago estable (concepto)',
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

  const referenceCents=Math.round(price/rate*100);
  const sellerCents=Math.round(seller*100);
  if(!Number.isSafeInteger(referenceCents)||referenceCents<=0
    ||referenceCents>100_000_000)return null;
  const differenceCents=sellerCents-referenceCents;
  // Todo resultado de la calculadora carece de tasa verificable, consentimiento,
  // tarifas reales, impuestos, fuente FX y autorización bancaria.
  const token=tokenUsdExample===null||tokenUsdExample===''?null:
     positiveDecimal(tokenUsdExample,1_000_000,6);
  if(tokenUsdExample!==null&&tokenUsdExample!==''&&token===null)return null;
  const possibleUnits=token===null?null:Number((referenceCents/100/token).toFixed(6));
  if(possibleUnits!==null&&(!Number.isFinite(possibleUnits)||possibleUnits>1_000_000_000))return null;
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
