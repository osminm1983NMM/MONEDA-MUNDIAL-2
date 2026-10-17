// MONEDA MUNDIAL COIN — BORRADOR DE TRANSFERENCIA OBSERVABLE, SIN FIRMA.
// Sólo Base Sepolia (chainId 84532) como red de investigación. No existe Coin
// emitida ni contrato/deposito/saldo/tx en testnet. NO crea transacciones,
// no solicita frases semilla, no guarda direcciones y no consulta RPC.
import {inspectWatchOnlyWalletResearch, RESEARCH_CHAINS} from './watch-only-wallet-policy.mjs';
const ASSET='moneda_mundial_coin_research';
const UNITS=/^[1-9][0-9]{0,17}$/;
const allowed=['amountUnits','asset','chainId','recipientAddress','senderAddress'];
const invalid=Object.freeze({
 valid:false,reason:'invalid_or_unsafe_research_input',
 transactionPrepared:false,transactionSigned:false,
 transactionBroadcast:false,verifiedRecipient:false,
 productionWalletEnabled:false,canSend:false,realFundsEnabled:false,
});
function plain(v) {
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
}
export function previewWatchOnlyTransferResearch(payload) {
 if(!plain(payload))return invalid;
 const keys=Object.keys(payload).sort();
 if(keys.length!==allowed.length||keys.some((k,i)=>k!==allowed[i]))return invalid;
 if(payload.asset!==ASSET||payload.chainId!==RESEARCH_CHAINS.baseSepolia.chainId||
    typeof payload.amountUnits!=='string'||!UNITS.test(payload.amountUnits))return invalid;
 const sender=inspectWatchOnlyWalletResearch({
  chainId:payload.chainId,address:payload.senderAddress,
 });
 const recipient=inspectWatchOnlyWalletResearch({
  chainId:payload.chainId,address:payload.recipientAddress,
 });
 if(!sender.valid||!recipient.valid||
    sender.watchOnlyAddress===recipient.watchOnlyAddress)return invalid;
 return Object.freeze({
  valid:true,networkName:'Base Sepolia — SÓLO INVESTIGACIÓN',
  chainId:payload.chainId,asset:ASSET,
  hypotheticalAmountUnits:payload.amountUnits,
  senderPublicAddress:sender.watchOnlyAddress,
  recipientPublicAddress:recipient.watchOnlyAddress,
  addressOwnershipVerified:false,recipientIdentityVerified:false,
  tokenContractVerified:false,tokenDeployed:false,
  recipientCanReceiveConfirmed:false,
  networkConnected:false,gasFeeEstimated:false,
  balanceVerified:false,
  transactionPrepared:false,transactionSigned:false,
  transactionBroadcast:false,transactionHash:null,
  privateKeyRequested:false,keysStored:false,
  productionWalletEnabled:false,verifiedRecipient:false,
  canSend:false,realFundsEnabled:false,
  status:'address_review_only_no_transaction',
 });
}
