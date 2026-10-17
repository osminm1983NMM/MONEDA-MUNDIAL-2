// Vista PÚBLICA informativa para usuarios de Android sin cuenta.
// NO consulta backend, ni Supabase, ni contratos, ni crea saldo o tokens.
import {CRYPTO_CONCEPT_OPTIONS,getCryptoConceptCard} from './digital-money/crypto-ui-state.mjs';

const COPY=Object.freeze({
 es:Object.freeze({
  heading:'Explorar Coin y Digital sin cuenta',
  warning:'INVESTIGACIÓN SOLAMENTE · NO HAY CRIPTOMONEDAS EMITIDAS',
  subtitle:'Dos proyectos separados; no son los créditos MWD de prueba.',
  returnLabel:'Volver al recorrido de Moneda Mundial',
  footer:'No hay billetera conectada ni precio oficial. Comprar, vender, pagar y transferir están deshabilitados.',
  explanations:Object.freeze({
   coin:'Futura criptomoneda de precio variable. El mercado podría determinar su valor si se emite y comercializa legalmente.',
   digital:'Proyecto de activo estable con referencia deseada al USD. La paridad, el respaldo y la redención no están aprobados.',
  }),
 }),
 en:Object.freeze({
  heading:'Explore Coin and Digital without an account',
  warning:'RESEARCH ONLY · NO CRYPTO TOKENS HAVE BEEN ISSUED',
  subtitle:'Two separate projects, distinct from fictitious MWD demo credits.',
  returnLabel:'Back to the Moneda Mundial tour',
  footer:'No wallet or official price. Buying, selling, payments and transfers are disabled.',
  explanations:Object.freeze({
   coin:'Proposed variable-price cryptocurrency. A market might determine its price if it is legally issued and traded.',
   digital:'Proposed stable-value asset targeting USD. Parity, backing and redemption have not been approved.',
  }),
 }),
});

export const GUEST_CRYPTO_REAL_FUNDS_ENABLED=false;
export function getGuestCryptoResearchPreview(language='es'){
 const copy=COPY[language==='en'?'en':'es'];
 const cards=CRYPTO_CONCEPT_OPTIONS.map(id=>{
  const asset=getCryptoConceptCard(id);
  if(!asset || asset.tokenIssued!==false || asset.realFundsEnabled!==false ||
   asset.walletConnected!==false || asset.currentBalance!==null ||
   asset.marketPriceUsd!==null || asset.canBuy!==false ||
   asset.canSell!==false || asset.canTransfer!==false ||
   asset.canConvert!==false || asset.canPayMerchant!==false){
    throw Error('La vista pública no debe anunciar activos operativos');
  }
  return Object.freeze({
   id,title:asset.title,description:copy.explanations[id],
   status:language==='en'?'NOT ISSUED':'NO EMITIDA',
   realFundsEnabled:false,
  });
 });
 return Object.freeze({
  heading:copy.heading,warning:copy.warning,subtitle:copy.subtitle,
  returnLabel:copy.returnLabel,footer:copy.footer,
  cards:Object.freeze(cards),
  noAccountRequired:true,bankAccountConnected:false,
  userIdentityKnown:false,realMoneyEnabled:false,
 });
}
