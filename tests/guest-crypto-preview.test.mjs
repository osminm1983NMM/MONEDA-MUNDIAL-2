import test from 'node:test';
import assert from 'node:assert/strict';
import {GUEST_CRYPTO_REAL_FUNDS_ENABLED,getGuestCryptoResearchPreview}
 from '../src/guest-crypto-preview.mjs';

test('la vista pública separa Coin y Digital sin crear saldo ni moneda',()=>{
 assert.equal(GUEST_CRYPTO_REAL_FUNDS_ENABLED,false);
 for(const lang of ['es','en','pt',null,undefined]){
  const v=getGuestCryptoResearchPreview(lang);
  assert.equal(v.noAccountRequired,true);
  assert.equal(v.realMoneyEnabled,false);
  assert.equal(v.cards.length,2);
  assert.deepEqual(v.cards.map(x=>x.id),['coin','digital']);
  assert.equal(v.cards[0].title,'Moneda Mundial Coin');
  assert.equal(v.cards[1].title,'Moneda Mundial Digital');
  assert.ok(v.cards.every(x=>x.realFundsEnabled===false));
  assert.ok(v.warning.length>10);
  assert.ok(v.footer.length>10);
  assert.ok(v.returnLabel.length>10);
  assert.equal(Object.isFrozen(v),true);
  assert.equal(Object.isFrozen(v.cards),true);
 }
});
test('sin conexión, rutas transaccionales, datos personales ni precios falsos',()=>{
 const data=JSON.stringify(getGuestCryptoResearchPreview('es'))+
    JSON.stringify(getGuestCryptoResearchPreview('en'));
 assert.doesNotMatch(data,/https?:\/\/|service_role|access_token|privateKey|seedPhrase|apikey/i);
 assert.doesNotMatch(data,/\$0\.1(?:0)?|10,?000 MWD|1\s*Digital\s*=\s*1\s*USD/i);
 assert.match(data,/NO EMITIDA/);
 assert.equal(getGuestCryptoResearchPreview('es').bankAccountConnected,false);
 assert.equal(getGuestCryptoResearchPreview('es').userIdentityKnown,false);
});
