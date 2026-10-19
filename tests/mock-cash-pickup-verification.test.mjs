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

test('rechaza datos personales, pagos declarados y opciones extra sin emitir código',()=>{
 t=1700000000000;
 const m=make();
 const valid={caseId:'SIM-HN-EXTRACHECK11',beneficiaryAlias:'SAMPLE-HN-EXTRACHECK11',country:'HN',amountCents:10000};
 for(const extra of [{recipientName:'FICTICIO'},{passport:'SAMPLE-NO-REAL'}, {paid:true},{bankAccount:'0000'},{providerToken:'bad'}]){
  assert.throws(()=>m.createSample({...valid,...extra}),/prohibidos/);
 }
 const sample=m.createSample(valid);
 assert.equal(m.inspectSample(valid.caseId).failedAttempts,0);
 const check={caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:valid.beneficiaryAlias};
 for(const extra of [{beneficiaryDocument:'SAMPLE'},{realIdentityVerified:true},{canPay:true}]){
  assert.throws(()=>m.verifySyntheticCode({...check,...extra}),/inesperados/);
 }
 assert.equal(m.inspectSample(valid.caseId).failedAttempts,0);
 assert.equal(m.verifySyntheticCode(check).acceptedMock,true);
 assert.equal(m.inspectSample(valid.caseId).status,'consumed_mock');
 assert.equal(m.inspectSample(valid.caseId).realMoneyEnabled,false);
 assert.throws(()=>createMockCashPickupVerifier({secret,providerApiToken:'bad'}),/Configuración/);
});
test('el catálogo internacional no habilita pagos: HN, NI, CR y EC solo DEMO',()=>{
 t=1700000000000;
 assert.throws(()=>createMockCashPickupVerifier({secret,countryCodes:['HN','HN']}),/Catálogo/);
 assert.throws(()=>createMockCashPickupVerifier({secret,countryCodes:['US']}),/Catálogo/);
 const defaultVerifier=make();
 assert.throws(()=>defaultVerifier.createSample({caseId:'SIM-CR-TESTCODE123',beneficiaryAlias:'SAMPLE-CR-TESTCODE123',country:'CR',amountCents:10000}),/inválido/);
 const v=createMockCashPickupVerifier({secret,clock:()=>t,countryCodes:['HN','NI','CR','EC']});
 for(const country of ['HN','NI','CR','EC']){
  const beneficiaryAlias='SAMPLE-'+country+'-COUNTRYTEST09';
  const sample=v.createSample({caseId:'SIM-'+country+'-COUNTRYTEST09',beneficiaryAlias,country,amountCents:10000});
  const response=v.verifySyntheticCode({caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias});
  assert.equal(response.acceptedMock,true);
  assert.equal(response.realIdentityConfirmed,false);
  assert.equal(response.moneyDelivered,false);
  assert.equal(response.canPay,false);
  assert.equal(response.redeemableAtAnyAgent,false);
 }
 assert.equal(v.sanitizedAudit().filter(x=>x.kind==='sample_issued_mock').length,4);
});

test('la inspección actualiza la expiración sin mostrar código ni duplicar auditoría',()=>{
 t=1700000000000;
 const m=make();
 const issued=create(m);
 assert.equal(m.inspectSample(issued.caseId).status,'issued_mock');
 t+=15*60*1000;
 const expired=m.inspectSample(issued.caseId);
 assert.equal(expired.status,'expired_mock');
 assert.equal(expired.canPay,false);
 assert.equal(expired.moneyDelivered,false);
 assert.equal(JSON.stringify(expired).includes(issued.sampleCode),false);
 assert.equal(m.inspectSample(issued.caseId).status,'expired_mock');
 assert.equal(m.sanitizedAudit().filter(e=>e.kind==='sample_expired_mock').length,1);
 assert.equal(m.verifySyntheticCode({caseId:issued.caseId,sampleCode:issued.sampleCode,beneficiaryAlias:'SAMPLE-HN-ABCD1234'}).acceptedMock,false);
 t=1700000000000;
});
