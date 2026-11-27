'use strict';
// Deterministic robustness checks for the offline, unauthenticated parser.
// Fixtures contain no real provider/customer information.
const {test}=require('node:test');
const a=require('node:assert/strict');
const {inspectThunesResponseBytes:inspect}=require('../../financial-sandbox/thunes-response-bytes.cjs');
const expected={transactionId:123,externalId:'order-1',payerId:777,serviceId:888,sourceMinor:10001,destinationMinor:250025};
const body='{"id":123,"external_id":"order-1","transaction_type":"C2C","status":"70000","status_message":"COMPLETED","status_class":"7","status_class_message":"COMPLETED","source":{"country_iso_code":"USA","currency":"USD","amount":100.01},"destination":{"currency":"HNL","amount":2500.25},"payer":{"id":777,"country_iso_code":"HND","currency":"HNL","service":{"id":888}}}';
const call=raw=>inspect({environment:'sandbox',expected,raw:Buffer.isBuffer(raw)?raw:Buffer.from(raw)});
const complete={mode:'sandbox',observation:'reported_completed',reason:null};
const extend=member=>body.slice(0,-1)+','+member+'}';
test('every strict nonempty byte prefix of a valid response fails closed',()=>{
 const bytes=Buffer.from(body);
 for(let i=1;i<bytes.length;i++){
  a.throws(()=>call(bytes.subarray(0,i)),e=>e.code==='INVALID_JSON','prefix '+i);
 }
 a.deepEqual(call(bytes),complete);
});
test('byte size limit is inclusive and counts UTF-8 bytes rather than characters',()=>{
 const blank=extend('"opaque":""');
 const padding=65536-Buffer.byteLength(blank);
 const exact=extend('"opaque":"'+'x'.repeat(padding)+'"');
 a.equal(Buffer.byteLength(exact),65536);
 a.deepEqual(call(exact),complete);
 a.throws(()=>call(exact+' '),e=>e.code==='INVALID_RESPONSE_BYTES');
 const multibyte=extend('"opaque":"'+'é'.repeat(Math.floor(padding/2)+1)+'"');
 a.ok(multibyte.length<65536);
 a.throws(()=>call(multibyte),e=>e.code==='INVALID_RESPONSE_BYTES');
});
test('valid escaping, ordering and non-sensitive unicode do not change observation',()=>{
 const obj=JSON.parse(body);
 const reordered=JSON.stringify(Object.fromEntries(Object.entries(obj).reverse()),null,2);
 a.deepEqual(call(reordered),complete);
 a.deepEqual(call(body.replace('"order-1"','"order-\\u0031"').replace('"status"','"\\u0073tatus"')),complete);
 a.deepEqual(call(extend('"opaque":"á漢😀\\uD83D\\uDE00"')),complete);
});
test('semantic changes to each required scalar in the supported completion cannot pass as completion',()=>{
 const paths=[
  ['id'],['external_id'],['transaction_type'],['status'],['status_message'],['status_class'],['status_class_message'],
  ['source','country_iso_code'],['source','currency'],['source','amount'],
  ['destination','currency'],['destination','amount'],['payer','id'],['payer','country_iso_code'],
  ['payer','currency'],['payer','service','id']
 ];
 for(const path of paths){
  for(const variant of ['missing',null,false,[],{},'invalid']){
   const obj=JSON.parse(body);let parent=obj;
   for(const key of path.slice(0,-1))parent=parent[key];
   if(variant==='missing')delete parent[path.at(-1)];else parent[path.at(-1)]=variant;
   const result=call(JSON.stringify(obj));
   a.equal(result.observation,'manual_review',path.join('.')+' '+JSON.stringify(variant));
   a.equal(Object.keys(result).sort().join(','),'mode,observation,reason');
  }
 }
});
test('all single-byte substitutions with selected control and invalid UTF-8 bytes fail safely',()=>{
 const bytes=Buffer.from(body);
 const allowed=new Set(['INVALID_JSON','INVALID_UTF8','DUPLICATE_JSON_KEY','INVALID_RESPONSE_OBJECT','RESPONSE_LIMIT']);
 for(let i=0;i<bytes.length;i++){
  for(const byte of [0,10,34,44,58,92,127,128,255]){
   if(bytes[i]===byte)continue;
   const mutated=Buffer.from(bytes);mutated[i]=byte;
   let result;
   try{result=call(mutated);}catch(e){a.ok(allowed.has(e.code),'unexpected error at '+i+': '+e.code);continue;}
   a.ok(['manual_review','reported_completed'].includes(result.observation));
   a.deepEqual(Object.keys(result).sort(),['mode','observation','reason']);
  }
 }
});
