import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCashPickupDemo,generateCashPickupSampleBytes} from '../src/cash-pickup-demo.mjs';

test('US hacia Nicaragua 100 USD: solo genera un ejemplo no cobrable',()=>{
  const b=new Uint8Array(Array.from({length:12},(_,i)=>i));
  const r=createCashPickupDemo({destination:'NI',amountCents:10000},b);
  assert.equal(r.referenceCode,'DEMO-NI-000102030405060708090A0B');
  assert.equal(r.amountCents,10000);
  assert.equal(r.status,'sample_not_redeemable');
  for(const key of ['funded','realPaymentsEnabled','partnerEnabled','redeemable','backendRegistered','identityVerified'])
    assert.equal(r[key],false,key);
  for(const key of ['payoutAmountCents','payoutCurrency','feeCents','exchangeRate','totalChargeCents'])
    assert.equal(r[key],null,key);
});
test('bloquear países sin simulación, cantidades inválidas y generadores inseguros',()=>{
  const bytes=new Uint8Array(12);
  for(const amountCents of [0,99,10000001,NaN,12.3,Infinity,-100])
    assert.equal(createCashPickupDemo({destination:'NI',amountCents},bytes),null);
  assert.equal(createCashPickupDemo({destination:'XX',amountCents:10000},bytes),null);
  assert.throws(()=>createCashPickupDemo({destination:'NI',amountCents:10000},new Uint8Array(8)),/seguro/);
  assert.throws(()=>generateCashPickupSampleBytes(null),/seguro/);
});
test('simulación no incorpora datos de identidad ni saldo de billeteras',()=>{
  const b=new Uint8Array(12);
  const r=createCashPickupDemo({destination:'NI',amountCents:10000},b);
  for(const forbidden of ['beneficiaryName','beneficiaryId','walletId','idNumber','bank','phone'])
    assert.equal(Object.hasOwn(r,forbidden),false,forbidden);
});
