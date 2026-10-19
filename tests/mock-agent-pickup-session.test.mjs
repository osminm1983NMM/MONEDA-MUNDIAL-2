import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockCashPickupVerifier} from '../src/server/mock-cash-pickup-verification.mjs';
import {createMockAgentPickupSession} from '../src/server/mock-agent-pickup-session.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({type:'spki',format:'pem'});
let t=1700000000000;
const gateway=()=>createMockInstitutionSessionGateway({clock:()=>t,members:[
 {memberId:'agent-hn-staff-001',institutionId:'agent-hn',state:'active_mock',publicKeyPem},
 {memberId:'agent-ni-staff-001',institutionId:'agent-ni',state:'active_mock',publicKeyPem},
 {memberId:'bank-hn-staff-001',institutionId:'bank-hn',state:'active_mock',publicKeyPem},
]});
const login=(g,id)=>{const c=g.beginMockChallenge({memberId:id});return g.completeMockChallenge({memberId:id,challengeId:c.challengeId,signatureBase64url:sign(null,Buffer.from(c.signedMessage),privateKey).toString('base64url')}).sessionToken;};
test('agente correcto consume UNA referencia ficticia sin pago',()=>{
 const g=gateway(),v=createMockCashPickupVerifier({secret:'sandbox-code-only-1234567890000000000',clock:()=>t});
 const item=v.createSample({caseId:'SIM-HN-TESTREF001',beneficiaryAlias:'SAMPLE-HN-TEST001',country:'HN',amountCents:10000});
 const p=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:v});
 const token=login(g,'agent-hn-staff-001');
 const input={sessionToken:token,caseId:item.caseId,sampleCode:item.sampleCode,beneficiaryAlias:'SAMPLE-HN-TEST001'};
 const r=p.verifySample(input);assert.equal(r.acceptedMock,true);assert.equal(r.canPay,false);
 assert.equal(p.verifySample(input).acceptedMock,false);
});
test('un banco o agente de otro país no consume el código',()=>{
 const g=gateway(),v=createMockCashPickupVerifier({secret:'sandbox-code-only-1234567890000000000',clock:()=>t});
 const item=v.createSample({caseId:'SIM-HN-TESTREF002',beneficiaryAlias:'SAMPLE-HN-TEST002',country:'HN',amountCents:20000});
 const p=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:v});
 for(const id of ['bank-hn-staff-001','agent-ni-staff-001']){
  const token=login(g,id);
  assert.equal(p.verifySample({sessionToken:token,caseId:item.caseId,sampleCode:item.sampleCode,beneficiaryAlias:'SAMPLE-HN-TEST002'}).acceptedMock,false);
 }
 assert.equal(v.inspectSample(item.caseId).status,'issued_mock');
});

test('agente rechaza datos extra o autorizaciones falsas antes de consumir el código',()=>{
 t=1700000000000;
 const g=gateway(),v=createMockCashPickupVerifier({secret:'sandbox-code-only-1234567890000000000',clock:()=>t});
 const item=v.createSample({caseId:'SIM-HN-EXTRAAGENT12',beneficiaryAlias:'SAMPLE-HN-EXTRAAGENT12',country:'HN',amountCents:10000});
 const p=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:v});
 const input={sessionToken:login(g,'agent-hn-staff-001'),caseId:item.caseId,
  sampleCode:item.sampleCode,beneficiaryAlias:'SAMPLE-HN-EXTRAAGENT12'};
 for(const patch of [{realIdentityConfirmed:true},{bankAccount:'0000'},{country:'NI'},
  {cashDelivered:true},{paymentProviderAuthorized:true}]){
  assert.throws(()=>p.verifySample({...input,...patch}),/inválida/);
 }
 assert.equal(v.inspectSample(item.caseId).status,'issued_mock');
 assert.equal(p.verifySample(input).acceptedMock,true);
 assert.equal(v.inspectSample(item.caseId).canPay,false);
});
