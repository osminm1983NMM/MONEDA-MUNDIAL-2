import test from 'node:test';
import assert from 'node:assert/strict';
import {RESEARCH_CHAINS,inspectWatchOnlyWalletResearch,evaluateTestnetContractReadiness} from '../src/digital-money/watch-only-wallet-policy.mjs';
const address='0x'+'a'.repeat(40);
test('acepta observación solo Base Sepolia y nunca maneja claves',()=>{
 const v=inspectWatchOnlyWalletResearch({chainId:84532,address});
 assert.equal(v.valid,true);
 assert.equal(v.watchOnlyAddress,address);
 assert.equal(v.canSign,false);
 assert.equal(v.canTransfer,false);
 assert.equal(v.keysStored,false);
 assert.equal(v.tokenBalanceKnown,false);
 assert.equal(RESEARCH_CHAINS.baseSepolia.realFundsEnabled,false);
});
test('rechaza dirección cero, mezcla no validada, blockchain real y material secreto',()=>{
 for(const p of [
 {chainId:1,address},{chainId:8453,address},
 {chainId:84532,address:'0x'+'0'.repeat(40)},
 {chainId:84532,address:'0x'+'a'.repeat(39)},
 {chainId:84532,address:'0xA'+ 'a'.repeat(39)},
 {chainId:84532,address,privateKey:'secret'},
 {chainId:84532,address,mnemonic:'words'},
 {chainId:84532,address,foo:'anything'},
 ])assert.equal(inspectWatchOnlyWalletResearch(p).valid,false);
});
test('todas las listas administrativas siguen sin autorizar desplegar contratos',()=>{
 const p=evaluateTestnetContractReadiness({
  legalReviewCompleted:true,economicPolicyApproved:true,
  threatModelReviewed:true,independentAuditCompleted:true,
 });
 assert.equal(p.checklistCompleted,true);
 assert.equal(p.deployAllowed,false);
 assert.equal(p.tokenIssued,false);
});
