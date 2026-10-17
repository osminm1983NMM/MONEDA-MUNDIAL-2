import test from 'node:test';
import assert from 'node:assert/strict';
import {CRYPTO_CONCEPT_OPTIONS,getCryptoConceptCard} from '../src/digital-money/crypto-ui-state.mjs';
import {CRYPTO_RELEASE_PHASES} from '../src/digital-money/crypto-release-gates.mjs';

test('el usuario distingue Coin y Digital, ambas sin tokens emitidos',()=>{
 assert.deepEqual(CRYPTO_CONCEPT_OPTIONS,['coin','digital']);
 const coin=getCryptoConceptCard('coin'),digital=getCryptoConceptCard('digital');
 assert.notEqual(coin.title,digital.title);
 assert.match(coin.subtitle,/precio variable/);
 assert.match(digital.description,/no una paridad garantizada/);
 assert.equal(coin.tokenIssued,false);
 assert.equal(digital.tokenIssued,false);
 assert.equal(coin.preparationAreas,CRYPTO_RELEASE_PHASES.coin_public_issuance.length);
 assert.equal(digital.preparationAreas,CRYPTO_RELEASE_PHASES.digital_stablecoin.length);
});
test('ninguna pantalla afirma saldo, cotización, comercio, red o capacidad operativa',()=>{
 for(const key of CRYPTO_CONCEPT_OPTIONS){
  const m=getCryptoConceptCard(key);
  for(const name of ['canBuy','canSell','canConvert','canTransfer',
   'canPayMerchant','canRedeem','realFundsEnabled','walletConnected']){
   assert.equal(m[name],false,key+':'+name);
  }
  assert.equal(m.currentBalance,null);
  assert.equal(m.marketPriceUsd,null);
  assert.equal(m.blockchain,null);
  assert.equal(m.status,'NO EMITIDA');
 }
});
test('un identificador no reconocido no genera criptomoneda',()=>{
 for(const key of ['mwd_demo_credits','bitcoin','coin2',null,undefined,1,{}])
  assert.equal(getCryptoConceptCard(key),null);
});
