import test from 'node:test';import assert from 'node:assert/strict';
import {createMockCashPickupVerifier} from '../src/server/mock-cash-pickup-verification.mjs';
const secret='mock-only-super-long-secret-not-for-production';
let t=1700000000000;
const make=()=>createMockCashPickupVerifier({secret,clock:()=>t});
const create=(m,country='HN')=>m.createSample({caseId:'SIM-'+country+'-ABCDEF1234',beneficiaryAlias:'SAMPLE-'+country+'-ABCD1234',country,amountCents:10000});
test('código sintético se consume una vez y nunca permite dinero',()=>{
 const m=make(),sample=create(m);assert.match(sample.sampleCode,/^SIMONLY-/);
 const result=m.verifySyntheticCode({caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:'SAMPLE-HN-ABCD1234'});
 assert.equal(result.acceptedMock,true);assert.equal(result.moneyDelivered,false);assert.equal(result.realIdentityConfirmed,false);
 const retry=m.verifySyntheticCode({caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:'SAMPLE-HN-ABCD1234'});
 assert.equal(retry.acceptedMock,false);assert.equal(m.inspectSample(sample.caseId).status,'consumed_mock');
 assert.equal(JSON.stringify(m.sanitizedAudit()).includes(sample.sampleCode),false);
 assert.equal(JSON.stringify(m.inspectSample(sample.caseId)).includes(sample.sampleCode),false);
});
test('cinco intentos incorrectos bloquean referencia sin datos personales',()=>{
 const m=make(),sample=create(m,'NI');
 for(let i=0;i<5;i++)assert.equal(m.verifySyntheticCode({caseId:sample.caseId,sampleCode:'BAD',beneficiaryAlias:'BAD'}).acceptedMock,false);
 assert.equal(m.inspectSample(sample.caseId).status,'locked_mock');
 assert.equal(m.verifySyntheticCode({caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:'SAMPLE-NI-ABCD1234'}).acceptedMock,false);
});
test('caduca y nunca vuelve a emitir mismo caso',()=>{
 const m=make(),sample=create(m);t+=15*60*1000;
 assert.equal(m.verifySyntheticCode({caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:'SAMPLE-HN-ABCD1234'}).reason,'expired');
 assert.throws(()=>create(m),/volver a emitir/);
 t=1700000000000;
});
test('rechaza autorización real y país o alias inconsistente',()=>{
 assert.throws(()=>createMockCashPickupVerifier({mode:'live',secret}),/BLOQUEADO/);
 const m=make();assert.throws(()=>m.createSample({caseId:'SIM-HN-ABCDEF1234',beneficiaryAlias:'SAMPLE-NI-ABCD1234',country:'HN',amountCents:10000}),/inválido/);
});
