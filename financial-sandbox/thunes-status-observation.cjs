'use strict';
// Offline interpretation of selected public Thunes Money Transfer v2 statuses.
// No network, credentials, signatures, money movement or ledger events.
const states=new Map([
 ['10000',['CREATED','1','CREATED','created']],
 ['20000',['CONFIRMED','2','CONFIRMED','processing']],
 ['20110',['CONFIRMED-UNDER-REVIEW-SLS','2','CONFIRMED','compliance_review']],
 ['20150',['CONFIRMED-WAITING-FOR-PICKUP','2','CONFIRMED','awaiting_pickup']],
 ['30000',['REJECTED','3','REJECTED','negative_review']],
 ['30110',['REJECTED-SLS-SENDER','3','REJECTED','compliance_review']],
 ['30120',['REJECTED-SLS-BENEFICIARY','3','REJECTED','compliance_review']],
 ['30392',['REJECTED-COMPLIANCE-REASON','3','REJECTED','compliance_review']],
 ['40000',['CANCELLED','4','CANCELLED','negative_review']],
 ['50000',['SUBMITTED','5','SUBMITTED','processing']],
 ['60000',['AVAILABLE','6','AVAILABLE','awaiting_pickup']],
 ['70000',['COMPLETED','7','COMPLETED','reported_completed']],
 ['80000',['REVERSED','8','REVERSED','reversal_review']],
 ['90000',['DECLINED','9','DECLINED','negative_review']]
]);
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=value=>Number.isSafeInteger(value)&&value>0;
const ref=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function classifyThunesObservation({environment,expected,transaction}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!id(expected?.transactionId)||!ref(expected?.externalId))fail('INVALID_EXPECTED_IDENTITY');
 const review=reason=>({mode:'sandbox',observation:'manual_review',reason});
 if(!transaction||transaction.id!==expected.transactionId||transaction.external_id!==expected.externalId||
 transaction.transaction_type!=='C2C')return review('IDENTITY_MISMATCH');
 const known=states.get(transaction.status);
 if(!known)return review('UNKNOWN_STATUS');
 const [message,statusClass,classMessage,observation]=known;
 if(transaction.status_message!==message||transaction.status_class!==statusClass||
 transaction.status_class_message!==classMessage)return review('CONTRADICTORY_STATUS');
 // Never return pickup codes, beneficiary details, authorization or normalized
 // provider events. Even reported completion is an unauthenticated observation.
 return {mode:'sandbox',observation,reason:null};
}
module.exports={classifyThunesObservation};
