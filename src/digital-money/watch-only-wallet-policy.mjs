// Moneda Mundial Coin: OBSERVACIÓN DE BILLETERA EN TESTNET.
// No genera, solicita ni guarda claves o frases semilla. No firma, no transfiere,
// no consulta RPC y no crea ninguna billetera ni saldo.
// Únicamente valida identificadores de una propuesta futura de modo seguro.
export const RESEARCH_CHAINS = Object.freeze({
  baseSepolia: Object.freeze({
    name: 'Base Sepolia — SOLO PRUEBAS',
    chainId: 84532,
    mode: 'testnet-research-only',
    realFundsEnabled: false,
    rpcConfigured: false,
    contractDeployed: false,
  }),
});
const RAW_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = '0x'+'0'.repeat(40);
const SENSITIVE_KEYS = Object.freeze([
  'privateKey','private_key','seed','seedPhrase','mnemonic','secret',
  'keystore','password','key','signer','recoveryPhrase','recovery_phrase',
]);
const rejected = Object.freeze({
  valid:false,reason:'invalid_or_unsafe_research_input',
  walletCreated:false,keysStored:false,canSign:false,canTransfer:false,
  tokenBalanceKnown:false,realFundsEnabled:false,
});
export function inspectWatchOnlyWalletResearch(payload){
  if(!payload || typeof payload!=='object' || Array.isArray(payload))
    return rejected;
  if(SENSITIVE_KEYS.some(key => Object.prototype.hasOwnProperty.call(payload,key)))
    return rejected;
  // Rechazar cualquier dato adicional desconocido evita que alguien envíe
  // secretos dentro de campos arbitrarios de la UI.
  const keys=Object.keys(payload);
  if(keys.some(key=>!['chainId','address'].includes(key)))return rejected;
  if(payload.chainId!==RESEARCH_CHAINS.baseSepolia.chainId)return rejected;
  const address=payload.address;
  if(typeof address!=='string' || !RAW_ADDRESS.test(address) ||
     address.toLowerCase()===ZERO_ADDRESS)return rejected;
  const raw=address.slice(2);
  // Sin keccak/EIP55 no prometer validación de checksum. Rechazamos direcciones
  // con mezcla mayúsculas/minúsculas y no 'corregimos' valores silenciosamente.
  if(raw!==raw.toLowerCase() && raw!==raw.toUpperCase())return rejected;
  return Object.freeze({
    valid:true,
    testnet:'Base Sepolia',
    chainId:RESEARCH_CHAINS.baseSepolia.chainId,
    watchOnlyAddress:'0x'+raw.toLowerCase(),
    walletCreated:false,
    keysStored:false,canSign:false,canTransfer:false,
    tokenBalanceKnown:false,realFundsEnabled:false,
    contractSelected:false,transactionPrepared:false,
    message:'Dirección TESTNET observada únicamente en memoria; sin billetera activa.',
  });
}
export function evaluateTestnetContractReadiness({
  legalReviewCompleted=false,
  economicPolicyApproved=false,
  threatModelReviewed=false,
  independentAuditCompleted=false,
}={}){
  // Ni todos los indicadores del lado cliente autorizan desplegar:
  // la verdadera aprobación requiere otro proceso, entidad y pipeline.
  return Object.freeze({
    checklistCompleted:legalReviewCompleted===true&&
      economicPolicyApproved===true&&threatModelReviewed===true&&
      independentAuditCompleted===true,
    contractDeployed:false,deployAllowed:false,
    tokenIssued:false,realFundsEnabled:false,
    signingAllowed:false,
    status:'research_gate_only',
  });
}
