import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDemoAccountSnapshot as validate,isCurrentDemoWalletRefresh as current}
 from '../src/demo-wallet-refresh-safety.mjs';

const A='uuid-account-a',B='uuid-account-b';
const id='f3f26e36-99d0-41e9-8670-cc6f48110f23';
const wallet={user_id:A,account_code:'MWD-ABCDEF0123456789',balance_cents:1000000};
const op={id,kind:'transfer',source_user_id:A,destination_user_id:B,
 amount_cents:1200,created_at:'2026-10-23T12:00:00Z',is_merchant_payment:false};
const snapshot=(o={})=>({
 expectedUserId:A,wallet,operations:[op],adminRow:null,...o,
});

test('sólo muestra saldo de la cuenta consultada y operaciones ficticias relacionadas',()=>{
 const v=validate(snapshot());
 assert.equal(v.wallet.user_id,A);
 assert.equal(v.wallet.balance_cents,1000000);
 assert.equal(v.operations[0].amount_cents,1200);
 assert.equal(v.realMoneyEnabled,false);
 assert.equal(v.bankFundsVerified,false);
 assert.equal(v.serverBalanceReconciled,false);
 assert.equal(Object.isFrozen(v.wallet),true);
 assert.equal(Object.isFrozen(v.operations),true);
 assert.equal(Object.isFrozen(v.operations[0]),true);
 assert.equal(v.adminRole,null);
});

test('rechaza billetera ajena, sin código, saldo corrupto o negativo',()=>{
 for(const w of [
  {...wallet,user_id:B},{...wallet,account_code:'MWD-BAD'},
  {...wallet,balance_cents:-1},{...wallet,balance_cents:'1000'},
  {...wallet,balance_cents:NaN},{...wallet,balance_cents:Infinity},
  {...wallet,balance_cents:1.5},
  {...wallet,balance_cents:Number.MAX_SAFE_INTEGER+1},
  null
 ]) assert.throws(()=>validate(snapshot({wallet:w})),/billetera ficticia inválida/);
});

test('nunca representa historial de otra cuenta ni recibos alterados',()=>{
 for(const operation of [
  {...op,source_user_id:B,destination_user_id:'third'},
  {...op,id:'bad'}, {...op,amount_cents:-2},
  {...op,amount_cents:3.5},{...op,amount_cents:100000001},
  {...op,kind:'bank_transfer_real'},
  {...op,created_at:'fecha inexistente'}, 
  {...op,is_merchant_payment:'true'},
 ])assert.throws(()=>validate(snapshot({operations:[operation]})),/billetera ficticia inválida/);
 assert.throws(()=>validate(snapshot({operations:[op,op]})),/billetera ficticia inválida/);
 assert.throws(()=>validate(snapshot({operations:null})),/billetera ficticia inválida/);
});

test('aportación ficticia y saldo cero son aceptables sin inventar dinero real',()=>{
 const donation={...op,kind:'contribution',destination_user_id:null};
 const v=validate(snapshot({wallet:{...wallet,balance_cents:0},
  operations:[donation],adminRow:{role:'viewer'}}));
 assert.equal(v.wallet.balance_cents,0);
 assert.equal(v.operations[0].kind,'contribution');
 assert.equal(v.adminRole,null);
 assert.equal(v.realMoneyEnabled,false);
});

test('administrador de prueba no implica autorización bancaria',()=>{
 const v=validate(snapshot({adminRow:{role:'owner'}}));
 assert.equal(v.adminRole,'owner');
 assert.equal(v.bankFundsVerified,false);
 assert.equal(v.realMoneyEnabled,false);
});

test('la respuesta vieja después de cambio de cuenta o actualización no se aplica',()=>{
 const p={requestedUserId:A,activeSession:{user:{id:A}},
  requestedEpoch:5,currentEpoch:5,
  requestedSequence:3,currentSequence:3};
 assert.equal(current(p),true);
 assert.equal(current({...p,activeSession:{user:{id:B}}}),false);
 assert.equal(current({...p,activeSession:null}),false);
 assert.equal(current({...p,currentEpoch:6}),false);
 assert.equal(current({...p,currentSequence:4}),false);
 assert.equal(current({...p,requestedSequence:0}),false);
});
