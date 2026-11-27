'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {inspectThunesCorridorObservation:inspect}=require('../../financial-sandbox/thunes-corridor-observation.cjs');
const expected={transactionId:123,externalId:'order-1-payout',payerId:777,serviceId:888,sourceMinor:10001,destinationMinor:250025};
const fixture=()=>({id:123,external_id:'order-1-payout',transaction_type:'C2C',
 status:'70000',status_message:'COMPLETED',status_class:'7',status_class_message:'COMPLETED',
 source:{country_iso_code:'USA',currency:'USD',amount:'100.01'},
 destination:{currency:'HNL',amount:'2500.25'},
 payer:{id:777,country_iso_code:'HND',currency:'HNL',service:{id:888}},
 payer_transaction_code:'synthetic-private',beneficiary:{name:'synthetic-only'}});
const run=(transaction=fixture(),e=expected)=>inspect({environment:'sandbox',expected:e,transaction});
test('matching corridor and exact amounts preserve observation only',()=>{
 a.deepEqual(run(),{mode:'sandbox',observation:'reported_completed',reason:null});
 const x=fixture();Object.assign(x,{status:'60000',status_message:'AVAILABLE',status_class:'6',status_class_message:'AVAILABLE'});
 a.equal(run(x).observation,'awaiting_pickup');
});
test('mismatched corridor, currency, payer and service fail closed',()=>{
 for(const alter of [
 x=>x.source.country_iso_code='CAN',x=>x.source.currency='HNL',
 x=>x.destination.currency='USD',x=>x.payer.country_iso_code='GTM',
 x=>x.payer.currency='USD',x=>delete x.payer
 ]){const x=fixture();alter(x);a.equal(run(x).reason,'CORRIDOR_MISMATCH');}
 for(const alter of [x=>x.payer.id=778,x=>x.payer.service.id=889,x=>delete x.payer.service]){
 const x=fixture();alter(x);a.equal(run(x).reason,'PAYER_MISMATCH');}
});
test('amounts cannot be rounded, coerced or silently accepted after floating point parsing',()=>{
 for(const value of ['100.02','100.010','100.011','1e2','00100.01','-100.01','0','999999999999999999999','100.01 ',100.01,null,undefined,{},true]){
  const x=fixture();x.source.amount=value;a.equal(run(x).reason,'AMOUNT_MISMATCH');
  const y=fixture();y.destination.amount=value;a.equal(run(y).reason,'AMOUNT_MISMATCH');
 }
 const z=fixture();z.source.amount='100.1';a.equal(run(z,{...expected,sourceMinor:10010}).observation,'reported_completed');
});
test('unknown states and conflicting identifiers are not upgraded by matching amounts',()=>{
 const x=fixture();x.status='79999';a.equal(run(x).reason,'UNKNOWN_STATUS');
 const y=fixture();y.external_id='different';a.equal(run(y).reason,'IDENTITY_MISMATCH');
 const z=fixture();z.status_class='6';a.equal(run(z).reason,'CONTRADICTORY_STATUS');
});
test('invalid expected contract or production environment is refused',()=>{
 for(const patch of [{externalId:'x'.repeat(65)},{sourceMinor:0},{destinationMinor:1.5},{payerId:0},{serviceId:'888'},{transactionId:-1}]){
 a.throws(()=>run(fixture(),{...expected,...patch}),/INVALID_EXPECTED_CONTRACT/);}
 a.throws(()=>inspect({environment:'production',expected,transaction:fixture()}),/SANDBOX_ONLY/);
});
