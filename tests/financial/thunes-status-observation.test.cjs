'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {classifyThunesObservation:classify}=require('../../financial-sandbox/thunes-status-observation.cjs');
const expected={transactionId:123,externalId:'order-1-payout'};
const fixture=(status,status_message,status_class,status_class_message)=>({
 id:123,external_id:'order-1-payout',transaction_type:'C2C',status,status_message,status_class,status_class_message,
 payer_transaction_code:'synthetic-private-code',beneficiary:{name:'synthetic-only'}
});
const run=transaction=>classify({environment:'sandbox',expected,transaction});
test('creation, confirmation, submission and pickup do not mean payout completed',()=>{
 for(const [s,m,c,cm,o] of [
 ['10000','CREATED','1','CREATED','created'],
 ['20000','CONFIRMED','2','CONFIRMED','processing'],
 ['50000','SUBMITTED','5','SUBMITTED','processing'],
 ['20150','CONFIRMED-WAITING-FOR-PICKUP','2','CONFIRMED','awaiting_pickup'],
 ['60000','AVAILABLE','6','AVAILABLE','awaiting_pickup']])
 a.deepEqual(run(fixture(s,m,c,cm)),{mode:'sandbox',observation:o,reason:null});
});
test('completion is only an observation and never exposes pickup code or private fields',()=>{
 const x=run(fixture('70000','COMPLETED','7','COMPLETED'));
 a.deepEqual(x,{mode:'sandbox',observation:'reported_completed',reason:null});
});
test('rejection, cancellation, decline, reversal and sanctions never authorize refunds',()=>{
 for(const [s,m,c,cm,o] of [
 ['30000','REJECTED','3','REJECTED','negative_review'],
 ['40000','CANCELLED','4','CANCELLED','negative_review'],
 ['90000','DECLINED','9','DECLINED','negative_review'],
 ['80000','REVERSED','8','REVERSED','reversal_review'],
 ['20110','CONFIRMED-UNDER-REVIEW-SLS','2','CONFIRMED','compliance_review'],
 ['30110','REJECTED-SLS-SENDER','3','REJECTED','compliance_review'],
 ['30120','REJECTED-SLS-BENEFICIARY','3','REJECTED','compliance_review'],
 ['30392','REJECTED-COMPLIANCE-REASON','3','REJECTED','compliance_review']])
 a.deepEqual(run(fixture(s,m,c,cm)),{mode:'sandbox',observation:o,reason:null});
});
test('unknown codes, wrong types, contradictory classes and unrelated transactions fail closed',()=>{
 const good=fixture('70000','COMPLETED','7','COMPLETED');
 for(const patch of [{status:'79999'},{status:70000},{status:'30350'}])
 a.equal(run({...good,...patch}).reason,'UNKNOWN_STATUS');
 for(const patch of [{status_message:'AVAILABLE'},{status_class:'6'},{status_class_message:'SUBMITTED'},{status_class:7}])
 a.equal(run({...good,...patch}).reason,'CONTRADICTORY_STATUS');
 for(const patch of [{id:124},{external_id:'other'},{transaction_type:'B2B'}])
 a.equal(run({...good,...patch}).reason,'IDENTITY_MISMATCH');
 a.equal(run(null).reason,'IDENTITY_MISMATCH');
 a.throws(()=>classify({environment:'production',expected,transaction:good}),/SANDBOX_ONLY/);
 a.throws(()=>classify({environment:'sandbox',expected:{transactionId:0,externalId:'x'},transaction:good}),/INVALID_EXPECTED_IDENTITY/);
});
