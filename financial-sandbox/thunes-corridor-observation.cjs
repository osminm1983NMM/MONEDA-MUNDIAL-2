'use strict';
// Offline US->HN observation binding. No authorization, transport, PII or ledger.
const {classifyThunesObservation}=require('./thunes-status-observation.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const positive=v=>Number.isSafeInteger(v)&&v>0;
const validRef=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
// Inputs are decimal lexemes preserved by a future lossless JSON decoder.
// Never round an already parsed JS floating point number to cents.
function minor(value){
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,2})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');
 const n=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
 return n>0n&&n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
}
function inspectThunesCorridorObservation({environment,expected,transaction}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!positive(expected?.transactionId)||!validRef(expected?.externalId)||
 !positive(expected?.payerId)||!positive(expected?.serviceId)||
 !positive(expected?.sourceMinor)||!positive(expected?.destinationMinor))fail('INVALID_EXPECTED_CONTRACT');
 const review=reason=>({mode:'sandbox',observation:'manual_review',reason});
 const state=classifyThunesObservation({environment,expected,transaction});
 if(state.observation==='manual_review')return state;
 if(transaction.source?.country_iso_code!=='USA'||transaction.source?.currency!=='USD'||
 transaction.destination?.currency!=='HNL'||transaction.payer?.country_iso_code!=='HND'||
 transaction.payer?.currency!=='HNL')return review('CORRIDOR_MISMATCH');
 if(transaction.payer.id!==expected.payerId||transaction.payer.service?.id!==expected.serviceId)
 return review('PAYER_MISMATCH');
 if(minor(transaction.source.amount)!==expected.sourceMinor||
 minor(transaction.destination.amount)!==expected.destinationMinor)return review('AMOUNT_MISMATCH');
 // The output remains an observation, not a verified callback or payment instruction.
 return state;
}
module.exports={inspectThunesCorridorObservation};
