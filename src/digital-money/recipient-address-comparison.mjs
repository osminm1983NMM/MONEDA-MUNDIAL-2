// MONEDA MUNDIAL COIN: doble comparación LOCAL de dirección pública EVM.
// Investigación estricta de Base Sepolia: NUNCA valida identidad, propiedad,
// beneficiario, contrato, fondos, saldo ni seguridad criptográfica. No firma,
// no produce transacciones y no guarda datos en la nube.
// La segunda dirección debe obtenerse de una fuente confiable INDEPENDIENTE;
// pegar dos veces el mismo dato no aporta protección real.
import {inspectWatchOnlyWalletResearch,RESEARCH_CHAINS} from './watch-only-wallet-policy.mjs';

const FIELDS=['chainId','independentlyConfirmedAddress','recipientAddress'];
const REJECTED=Object.freeze({
 formatValid:false,fullAddressMatch:false,reason:'invalid_or_unsafe_research_input',
 sourceIndependenceVerified:false,recipientIdentityVerified:false,
 recipientOwnershipVerified:false,recipientAuthorized:false,
 networkConnectionEstablished:false,addressChecksumVerified:false,
 transactionCreated:false,transactionSigned:false,
 transactionBroadcast:false,canSend:false,realFundsEnabled:false,
});
function plain(v){
 return v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
}
export function compareRecipientPublicAddresses(payload){
 if(!plain(payload))return REJECTED;
 const keys=Object.keys(payload).sort();
 if(keys.length!==FIELDS.length||keys.some((k,i)=>k!==FIELDS[i]))return REJECTED;
 if(payload.chainId!==RESEARCH_CHAINS.baseSepolia.chainId)return REJECTED;
 const main=inspectWatchOnlyWalletResearch({chainId:payload.chainId,address:payload.recipientAddress});
 const other=inspectWatchOnlyWalletResearch({chainId:payload.chainId,address:payload.independentlyConfirmedAddress});
 if(!main.valid||!other.valid)return REJECTED;
 const equal=main.watchOnlyAddress===other.watchOnlyAddress;
 return Object.freeze({
  formatValid:true,fullAddressMatch:equal,
  chainId:payload.chainId,
  reason:equal?'formatted_addresses_match_not_verified':'public_address_mismatch',
  // El origen de la segunda copia no puede validarse desde el teléfono.
  sourceIndependenceVerified:false,recipientIdentityVerified:false,
  recipientOwnershipVerified:false,recipientAuthorized:false,
  networkConnectionEstablished:false,addressChecksumVerified:false,
  transactionCreated:false,transactionSigned:false,
  transactionBroadcast:false,canSend:false,realFundsEnabled:false,
 });
}
