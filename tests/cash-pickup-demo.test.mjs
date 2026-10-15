import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCashPickupDemo,generateCashPickupSampleBytes,normalizeCashPickupCountries} from '../src/cash-pickup-demo.mjs';
const worldCatalog=[
 {code:'NI',name:'Nicaragua',demoAvailable:false,realPaymentsEnabled:false},
 {code:'CR',name:'Costa Rica',demoAvailable:true,realPaymentsEnabled:false},
 {code:'US',name:'Estados Unidos',demoAvailable:false,realPaymentsEnabled:false},
 {code:'JP',name:'Japón',demoAvailable:false,realPaymentsEnabled:false},
];

test('US a Nicaragua 100 USD: código ficticio no cobrable',()=>{
 const r=createCashPickupDemo({destination:'NI',amountCents:10000,worldCatalog},new Uint8Array(12));
 assert.equal(r.referenceCode,'DEMO-NI-000000000000000000000000');
 assert.equal(r.status,'sample_not_redeemable');
 for(const x of ['realPaymentsEnabled','partnerEnabled','funded','redeemable','backendRegistered','identityVerified'])
   assert.equal(r[x],false,x);
 for(const x of ['payoutAmountCents','payoutCurrency','feeCents','exchangeRate','totalChargeCents'])
   assert.equal(r[x],null,x);
});
test('destinos de todo el catálogo permitidos para DISEÑO sin agentes',()=>{
 for(const destination of ['NI','CR','JP','US']) {
   const r=createCashPickupDemo({destination,amountCents:10000,worldCatalog},new Uint8Array(12));
   assert.ok(r);
   assert.equal(r.destination,destination);
   assert.equal(r.realPaymentsEnabled,false);
   assert.equal(r.redeemable,false);
 }
 const countries=normalizeCashPickupCountries(worldCatalog);
 assert.equal(countries.length,4);
 assert.ok(countries.every(c=>c.cashPickupRealEnabled===false&&c.partnerAvailable===false));
});
test('rechazar países ajenos al catálogo, entradas corruptas y catálogos vacíos',()=>{
 assert.equal(createCashPickupDemo({destination:'ZZ',amountCents:10000,worldCatalog},new Uint8Array(12)),null);
 assert.equal(createCashPickupDemo({destination:'NI',amountCents:10000,worldCatalog:null},new Uint8Array(12)),null);
 const invalid=normalizeCashPickupCountries([{code:'XX',name:'X'},{code:'XX',name:'X 2'},{code:'!!',name:'Bad'},null]);
 assert.equal(invalid.length,1);
 for(const amountCents of [0,99,10000001,NaN,12.3,Infinity,-100])
   assert.equal(createCashPickupDemo({destination:'NI',amountCents,worldCatalog},new Uint8Array(12)),null);
 assert.throws(()=>createCashPickupDemo({destination:'NI',amountCents:10000,worldCatalog},new Uint8Array(8)),/seguro/);
 assert.throws(()=>generateCashPickupSampleBytes(null),/seguro/);
});
test('sin datos personales ni movimientos de dinero',()=>{
 const r=createCashPickupDemo({destination:'JP',amountCents:10000,worldCatalog},new Uint8Array(12));
 for(const key of ['beneficiaryName','beneficiaryId','walletId','idNumber','bank','phone'])
   assert.equal(Object.hasOwn(r,key),false,key);
});
