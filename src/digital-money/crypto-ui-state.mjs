// Modelo visible de las DOS criptomonedas que se estudian para Moneda Mundial.
// No crea cuenta, saldo, clave privada, blockchain, precio ni derecho de redención.
import {CRYPTO_ASSETS,CRYPTO_RELEASE_PHASES} from './crypto-release-gates.mjs';

const VIEW=Object.freeze({
 coin:Object.freeze({
  id:'coin',
  title:'Moneda Mundial Coin',
  subtitle:'Criptomoneda de precio variable · proyecto en investigación',
  description:'El mercado determinaría su valor si alguna vez se emite y se negocia legalmente. Oferta, red, distribución y precio siguen pendientes.',
  status:'NO EMITIDA',
  reference:'Precio de mercado: NO DISPONIBLE',
  heading:'Condiciones previas para investigar una emisión',
  phase:'coin_public_issuance',
  highlights:Object.freeze([
   'Modelo económico y oferta por definir',
   'Contrato y seguridad pendientes de auditoría independiente',
   'Clasificación legal y jurisdicciones por resolver',
  ]),
 }),
 digital:Object.freeze({
  id:'digital',
  title:'Moneda Mundial Digital',
  subtitle:'Activo estable deseado · concepto separado de Coin',
  description:'La referencia 1 Digital ≈ 1 USD es una meta, no una paridad garantizada. Se requiere un emisor legalmente habilitado, respaldo y reglas de redención.',
  status:'NO EMITIDA',
  reference:'Paridad 1:1: NO VERIFICADA',
  heading:'Condiciones previas para ofrecer valor estable',
  phase:'digital_stablecoin',
  highlights:Object.freeze([
   'Emisor regulado o acuerdo con tercero autorizado',
   'Respaldo, reservas y derecho de redención verificables',
   'Seguridad de custodia, pagos y protección al consumidor',
  ]),
 }),
});
export const CRYPTO_CONCEPT_OPTIONS=Object.freeze(['coin','digital']);

export function getCryptoConceptCard(key) {
 if(typeof key!=='string'||!Object.hasOwn(VIEW,key))return null;
 const info=VIEW[key],asset=CRYPTO_ASSETS[key];
 return Object.freeze({
  ...info,
  preparationAreas:CRYPTO_RELEASE_PHASES[info.phase].length,
  // NO mezclar MWD de pruebas con cripto real ni declarar saldos inventados.
  currentBalance:null,marketPriceUsd:null,blockchain:null,
  tokenIssued:asset.tokenIssued,
  walletConnected:false,
  canBuy:false,canSell:false,canConvert:false,canTransfer:false,
  canPayMerchant:false,canRedeem:false,realFundsEnabled:false,
  isSimulation:true,
 });
}
