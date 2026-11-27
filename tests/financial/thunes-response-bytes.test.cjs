'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const {inspectThunesResponseBytes:inspect}=require('../../financial-sandbox/thunes-response-bytes.cjs');
const expected={transactionId:123,externalId:'order-1-payout',payerId:777,serviceId:888,sourceMinor:10001,destinationMinor:250025};
const body='{"id":123,"external_id":"order-1-payout","transaction_type":"C2C","status":"70000","status_message":"COMPLETED","status_class":"7","status_class_message":"COMPLETED","source":{"country_iso_code":"USA","currency":"USD","amount":100.01},"destination":{"currency":"HNL","amount":2500.25},"payer":{"id":777,"country_iso_code":"HND","currency":"HNL","service":{"id":888}},"beneficiary":{"name":"synthetic"}}';
const run=(s=body)=>inspect({environment:'sandbox',expected,raw:Buffer.from(s)});
test('original decimal numeric tokens and exact IDs are preserved; private fields discarded',()=>{
 a.deepEqual(run(),{mode:'sandbox',observation:'reported_completed',reason:null});
 a.equal(run(' \n'+body+'\t').observation,'reported_completed');
});
test('rounding, exponent, string coercion and unsafe identifiers do not pass',()=>{
 for(const v of ['100.0100000000000000001','100.010','1.0001e2','"100.01"','null','true'])
 a.equal(run(body.replace('100.01',v)).reason,'AMOUNT_MISMATCH');
 for(const v of ['123.000000000000000001','123e0','9007199254740993','"123"'])
 a.equal(run(body.replace('"id":123','"id":'+v)).reason,'IDENTITY_MISMATCH');
});
test('duplicate keys including escaped equivalent keys are rejected at every depth',()=>{
 for(const s of [body.replace('"id":123','"id":123,"id":123'),body.replace('"amount":100.01','"amount":100.01,"\\u0061mount":100.01'),body.replace('"name":"synthetic"','"name":"synthetic","name":"synthetic"')])
 a.throws(()=>run(s),/DUPLICATE_JSON_KEY/);
});
test('malformed JSON, invalid UTF8, non-object and bounded resource violations fail closed',()=>{
 for(const s of [body+'x',body.slice(0,-1),body.replace('100.01','01'),body.replace('100.01','1.'),body.replace('100.01','+1'),body.replace('"id":123','"id":123,'),'{}{}'])
 a.throws(()=>run(s),/INVALID_JSON/);
 for(const s of ['[]','null','1','"test"'])a.throws(()=>run(s),/INVALID_RESPONSE_OBJECT/);
 a.throws(()=>run('{"nested":'+'['.repeat(26)+'0'+']'.repeat(26)+'}'),/RESPONSE_LIMIT/);
 a.throws(()=>run('{"many":['+'0,'.repeat(10001)+'0]}'),/RESPONSE_LIMIT/);
 a.throws(()=>run(' '.repeat(65537)),/INVALID_RESPONSE_BYTES/);
 a.throws(()=>inspect({environment:'sandbox',expected,raw:Buffer.from([0xc0,0xaf])}),/INVALID_UTF8/);
 a.throws(()=>inspect({environment:'production',expected,raw:Buffer.from(body)}),/SANDBOX_ONLY/);
});
test('unknown fields and prototype-like keys cannot change the normalized observation',()=>{
 a.equal(run(body.replace('"beneficiary":','"__proto__":{"status":"90000"},"beneficiary":')).observation,'reported_completed');
 a.equal(run(body.replace('"status":"70000"','"status":"79999"')).reason,'UNKNOWN_STATUS');
});
