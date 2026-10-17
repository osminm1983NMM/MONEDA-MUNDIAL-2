import test from 'node:test';
import assert from 'node:assert/strict';
import {previewWatchOnlyTransferResearch} from '../src/digital-money/watch-only-transfer-preview.mjs';

const a='0x'+'a'.repeat(40),b='0x'+'b'.repeat(40);
const sample={asset:'moneda_mundial_coin_research',chainId:84532,
 senderAddress:a,recipientAddress:b,amountUnits:'100'};

test('revisa direcciones PÚBLICAS diferentes en Base Sepolia sin preparar operación',()=>{
 const out=previewWatchOnlyTransferResearch(sample);
 assert.equal(out.valid,true);
 assert.equal(out.chainId,84532);
 assert.equal(out.hypotheticalAmountUnits,'100');
 assert.equal(out.senderPublicAddress,a);
 assert.equal(out.recipientPublicAddress,b);
 for(const flag of ['addressOwnershipVerified','recipientIdentityVerified',
  'tokenContractVerified','tokenDeployed','recipientCanReceiveConfirmed',
  'networkConnected','gasFeeEstimated','balanceVerified',
  'transactionPrepared','transactionSigned','transactionBroadcast',
  'privateKeyRequested','keysStored','productionWalletEnabled',
  'verifiedRecipient','canSend','realFundsEnabled']){
  assert.equal(out[flag],false,flag);
 }
 assert.equal(out.transactionHash,null);
});
test('bloquea mainnet, direcciones propias o cero y errores de formato',()=>{
 for(const candidate of [
  {...sample,chainId:8453},{...sample,chainId:1},
  {...sample,recipientAddress:a},
  {...sample,recipientAddress:a.toUpperCase().replace('0X','0x')},
  {...sample,recipientAddress:'0x'+'0'.repeat(40)},
  {...sample,recipientAddress:'0x'+'a'.repeat(39)},
  {...sample,senderAddress:'0xA'+'a'.repeat(39)},
  {...sample,senderAddress:'not-a-wallet'},
  {...sample,asset:'mwd_demo_credits'},
  {...sample,asset:'moneda_mundial_digital'},
  {...sample,amountUnits:'0'}, {...sample,amountUnits:'-1'},
  {...sample,amountUnits:'0.1'}, {...sample,amountUnits:'1e6'},
  {...sample,amountUnits:'1'.repeat(20)}, {...sample,amountUnits:100},
 ]){
  const v=previewWatchOnlyTransferResearch(candidate);
  assert.equal(v.valid,false,JSON.stringify(candidate));
  assert.equal(v.canSend,false);
 }
});
test('rechaza cualquier campo extra para evitar llaves privadas o metadata filtrada',()=>{
 for(const extra of ['privateKey','seedPhrase','mnemonic','signature','nonce',
  'gasLimit','rpcUrl','productionMode','recoveryPhrase','password']){
  const v=previewWatchOnlyTransferResearch({...sample,[extra]:'not-allowed'});
  assert.equal(v.valid,false,extra);
  assert.equal(JSON.stringify(v).includes('not-allowed'),false);
 }
 assert.equal(previewWatchOnlyTransferResearch(null).valid,false);
 assert.equal(previewWatchOnlyTransferResearch([]).valid,false);
 assert.equal(previewWatchOnlyTransferResearch({...sample,recipientAddress:undefined}).valid,false);
});
