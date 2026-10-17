import test from 'node:test';
import assert from 'node:assert/strict';
import {compareRecipientPublicAddresses} from '../src/digital-money/recipient-address-comparison.mjs';

const a='0x'+'a'.repeat(40), b='0x'+'b'.repeat(40);
const demo={chainId:84532,recipientAddress:a,independentlyConfirmedAddress:a};
test('coincidencia completa: verificación visual local sin validar identidad',()=>{
 const p=compareRecipientPublicAddresses(demo);
 assert.equal(p.formatValid,true);
 assert.equal(p.fullAddressMatch,true);
 assert.equal(p.reason,'formatted_addresses_match_not_verified');
 for(const flag of ['sourceIndependenceVerified','recipientIdentityVerified',
  'recipientOwnershipVerified','recipientAuthorized','networkConnectionEstablished',
  'addressChecksumVerified','transactionCreated','transactionSigned',
  'transactionBroadcast','canSend','realFundsEnabled']){
  assert.equal(p[flag],false,flag);
 }
 assert.equal(JSON.stringify(p).includes(a),false);
});
test('un carácter incorrecto o dirección distinta bloquea coincidencia',()=>{
 for(const other of [b,'0x'+'a'.repeat(39)+'b']){
  const p=compareRecipientPublicAddresses({...demo,independentlyConfirmedAddress:other});
  assert.equal(p.formatValid,true);
  assert.equal(p.fullAddressMatch,false);
  assert.equal(p.canSend,false);
 }
});
test('no admite red principal ni direcciones cero y formato no soportado',()=>{
 for(const bad of [
  {...demo,chainId:8453},{...demo,chainId:1},
  {...demo,independentlyConfirmedAddress:'0x'+'0'.repeat(40)},
  {...demo,recipientAddress:'0x'+'a'.repeat(39)},
  {...demo,recipientAddress:'0xA'+'a'.repeat(39)},
  {...demo,independentlyConfirmedAddress:'  '+a},
  {...demo,independentlyConfirmedAddress:undefined},
  {...demo,independentlyConfirmedAddress:11},
 ]){
  assert.equal(compareRecipientPublicAddresses(bad).fullAddressMatch,false);
 }
});
test('no acepta llaves privadas, frases secretas, RPC ni parámetros de transferencia',()=>{
 for(const field of ['privateKey','seedPhrase','mnemonic','password','rpcUrl',
  'gas','amount','token','signature','mode','nonce']){
  const v=compareRecipientPublicAddresses({...demo,[field]:'sensitive_material'});
  assert.equal(v.fullAddressMatch,false);
  assert.equal(v.canSend,false);
  assert.equal(JSON.stringify(v).includes('sensitive_material'),false);
 }
 assert.equal(compareRecipientPublicAddresses(null).fullAddressMatch,false);
 assert.equal(compareRecipientPublicAddresses([]).fullAddressMatch,false);
});
