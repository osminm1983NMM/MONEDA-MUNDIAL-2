import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockProviderIntegrationPort} from '../src/server/provider-integration-port.mjs';
import {createMockCashPickupVerifier} from '../src/server/mock-cash-pickup-verification.mjs';
import {createMockPickupBinding} from '../src/server/mock-pickup-binding.mjs';
import {createMockBeneficiaryBoundPickup} from '../src/server/mock-beneficiary-bound-pickup.mjs';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockAgentPickupSession} from '../src/server/mock-agent-pickup-session.mjs';
import {generateKeyPairSync,sign} from 'node:crypto';

const T=1800000000000;
const secret='synthetic-only-no-real-money-strong-fixture-123456';
const setup=()=>{
 const port=createMockProviderIntegrationPort({webhookSecret:secret,clock:()=>T});
 const verifier=createMockCashPickupVerifier({secret,clock:()=>T});
 const binding=createMockPickupBinding({providerPort:port,pickupVerifier:verifier});
 return {port,verifier,binding,
  bound:createMockBeneficiaryBoundPickup({providerPort:port,pickupBinding:binding})};
};
const order=(country='HN')=>({
 origin:'US',destination:country,sourceCurrency:'USD',amountCents:10000,payoutMethod:'cash_pickup',
});
const request=(id,country='HN',alias='SAMPLE-HN-RECIPIENT01')=>({
 requestId:'recipient-locked-'+id+'-0001',order:order(country),beneficiaryAlias:alias,
});
function complete(port,id) {
 const a=port.makeSyntheticEvent({id:'event-pend-'+id,transferId:id,status:'sandbox_pending'});
 const b=port.makeSyntheticEvent({id:'event-done-'+id,transferId:id,status:'sandbox_completed'});
 port.receiveSignedDemoEvent(a);port.receiveSignedDemoEvent(b);
}
const codeRequest=(id,country='HN',alias='SAMPLE-HN-RECIPIENT01')=>({
 demoTransferId:id,caseId:'SIM-'+country+'-LOCKEDCASE01',beneficiaryAlias:alias,
});

test('el código SAMPLE usa el alias fijado en la orden US→HN y se muestra sólo una vez',()=>{
 const {port,verifier,bound}=setup();
 const first=bound.submitRecipientBoundMockTransfer(request('hn'));
 assert.equal(first.syntheticRecipientBound,true);
 assert.equal(first.trueBeneficiaryIdentityVerified,false);
 assert.equal(first.bankFundingVerified,false);
 assert.equal(first.realMoneyEnabled,false);
 assert.throws(()=>bound.issueBoundSample(codeRequest(first.demoTransferId)),/no apta/);
 complete(port,first.demoTransferId);
 const issued=bound.issueBoundSample(codeRequest(first.demoTransferId));
 assert.match(issued.sampleCode,/^SIMONLY-[A-F0-9]{32}$/);
 assert.equal(issued.canPay,false);
 assert.equal(issued.trueBeneficiaryIdentityVerified,false);
 const repeat=bound.issueBoundSample(codeRequest(first.demoTransferId));
 assert.equal(repeat.alreadyIssued,true);
 assert.equal(Object.hasOwn(repeat,'sampleCode'),false);
 const inspected=bound.inspectBoundSample({demoTransferId:first.demoTransferId});
 assert.equal(inspected.codeStatus,'issued_mock');
 assert.equal(JSON.stringify(inspected).includes(issued.sampleCode),false);
 const verified=verifier.verifySyntheticCode({
  caseId:issued.caseId,sampleCode:issued.sampleCode,beneficiaryAlias:'SAMPLE-HN-RECIPIENT01'
 });
 assert.equal(verified.acceptedMock,true);
 assert.equal(verified.moneyDelivered,false);
 assert.equal(verifier.verifySyntheticCode({
  caseId:issued.caseId,sampleCode:issued.sampleCode,beneficiaryAlias:'SAMPLE-HN-RECIPIENT01'
 }).acceptedMock,false);
});

test('el beneficiario no se sustituye ni siquiera por otro alias del mismo país',()=>{
 const {port,bound,verifier}=setup();
 const first=bound.submitRecipientBoundMockTransfer(request('substitute'));
 complete(port,first.demoTransferId);
 assert.throws(()=>bound.issueBoundSample({
  ...codeRequest(first.demoTransferId),beneficiaryAlias:'SAMPLE-HN-ATTACKER99'
 }),/Beneficiario/);
 assert.throws(()=>bound.issueBoundSample(
  codeRequest(first.demoTransferId,'NI','SAMPLE-NI-RECIPIENT01')
 ),/Beneficiario/);
 assert.equal(verifier.sanitizedAudit().length,0);
 assert.equal(bound.inspectBoundSample({demoTransferId:first.demoTransferId}),null);
 // El alias original todavía puede solicitar la muestra ficticia.
 assert.match(bound.issueBoundSample(codeRequest(first.demoTransferId)).sampleCode,/^SIMONLY-/);
});

test('no permite cambiar beneficiario, país o importe con la misma requestId',()=>{
 const {port,bound}=setup(),original=request('replay');
 const a=bound.submitRecipientBoundMockTransfer(original);
 const b=bound.submitRecipientBoundMockTransfer(original);
 assert.equal(a.demoTransferId,b.demoTransferId);
 assert.equal(b.alreadyProcessed,true);
 for(const edit of [
  {...original,beneficiaryAlias:'SAMPLE-HN-SWAPPED01'},
  {...original,order:{...original.order,amountCents:22000}},
  {...original,beneficiaryAlias:'SAMPLE-NI-RECIPIENT01',order:order('NI')}
 ])assert.throws(()=>bound.submitRecipientBoundMockTransfer(edit),/No se puede reemplazar/);
 assert.equal(port.sanitizedAudit().filter(e=>e.type==='mock_transfer_created').length,1);
});

test('si otro módulo creó una orden sin beneficiario, NO se puede adoptar después',()=>{
 const {port,bound}=setup(),input=request('external');
 const earlier=port.submitDemoTransfer({requestId:input.requestId,order:input.order});
 assert.ok(earlier.demoTransferId);
 assert.throws(()=>bound.submitRecipientBoundMockTransfer(input),/no verificable o no vinculada/);
 assert.equal(bound.inspectBoundSample.bind(bound)!==null,true);
});

test('Nicaragua se conserva con identidad ficticia consistente y sin pagos',()=>{
 const {port,bound}=setup();
 const recipientAlias='SAMPLE-NI-RECIPIENT02';
 const r=bound.submitRecipientBoundMockTransfer(request('nicaragua','NI',recipientAlias));
 assert.equal(r.destination,'NI');
 complete(port,r.demoTransferId);
 const sample=bound.issueBoundSample(codeRequest(r.demoTransferId,'NI',recipientAlias));
 assert.equal(sample.realMoneyEnabled,false);
 assert.equal(sample.syntheticRecipientBound,true);
 assert.equal(sample.destination,'NI');
});

test('el código de un caso no puede enlazarse a una remesa distinta',()=>{
 const {port,bound}=setup();
 const a=bound.submitRecipientBoundMockTransfer(request('casea'));
 const b=bound.submitRecipientBoundMockTransfer(request('caseb','HN','SAMPLE-HN-OTHERRECIP01'));
 complete(port,a.demoTransferId);complete(port,b.demoTransferId);
 bound.issueBoundSample(codeRequest(a.demoTransferId));
 assert.throws(()=>bound.issueBoundSample(
  codeRequest(b.demoTransferId,'HN','SAMPLE-HN-OTHERRECIP01')
 ),/vinculado a otra remesa/);
 assert.equal(bound.inspectBoundSample({demoTransferId:b.demoTransferId}),null);
});

test('el agente del país correcto sólo verifica el código del receptor de prueba',()=>{
 const {port,verifier,bound}=setup();
 const transfer=bound.submitRecipientBoundMockTransfer(request('agent'));
 complete(port,transfer.demoTransferId);
 const sample=bound.issueBoundSample(codeRequest(transfer.demoTransferId));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const publicKeyPem=publicKey.export({type:'spki',format:'pem'});
 const gateway=createMockInstitutionSessionGateway({clock:()=>T,members:[
  {memberId:'agent-hn-lab-001',institutionId:'agent-hn',state:'active_mock',publicKeyPem},
  {memberId:'agent-ni-lab-001',institutionId:'agent-ni',state:'active_mock',publicKeyPem},
 ]});
 const login=memberId=>{
  const c=gateway.beginMockChallenge({memberId});
  return gateway.completeMockChallenge({memberId,challengeId:c.challengeId,
   signatureBase64url:sign(null,Buffer.from(c.signedMessage),privateKey).toString('base64url')}).sessionToken;
 };
 const agent=createMockAgentPickupSession({sessionGateway:gateway,pickupVerifier:verifier});
 const req={caseId:sample.caseId,sampleCode:sample.sampleCode,beneficiaryAlias:'SAMPLE-HN-RECIPIENT01'};
 assert.equal(agent.verifySample({...req,sessionToken:login('agent-ni-lab-001')}).acceptedMock,false);
 assert.equal(verifier.inspectSample(sample.caseId).failedAttempts,0);
 const token=login('agent-hn-lab-001');
 const bad=agent.verifySample({...req,sessionToken:token,beneficiaryAlias:'SAMPLE-HN-OTHERRECIP01'});
 assert.equal(bad.acceptedMock,false);
 const checked=agent.verifySample({...req,sessionToken:token});
 assert.equal(checked.acceptedMock,true);
 assert.equal(checked.canPay,false);
 assert.equal(agent.verifySample({...req,sessionToken:token}).acceptedMock,false);
});

test('rechaza datos reales, campos inesperados, banco y alias de otro país',()=>{
 const {bound}=setup(),base=request('invalid');
 for(const o of [
  {...base,recipientName:'Ana'},
  {...base,bankAccount:'0000'},
  {...base,beneficiaryAlias:'SAMPLE-NI-RECIPIENT01'},
  {...base,order:{...base.order,payoutMethod:'bank_account'}},
  {...base,order:{...base.order,origin:'HN'}},
  {...base,order:{...base.order,amountCents:NaN}},
 ])assert.throws(()=>bound.submitRecipientBoundMockTransfer(o),/prohibidos|inválido/);
 assert.throws(()=>bound.issueBoundSample({caseId:'SIM-HN-ABCD123456',
  demoTransferId:'bad',beneficiaryAlias:'SAMPLE-HN-RECIPIENT01',passport:'real'}),/No enviar/);
 assert.throws(()=>createMockBeneficiaryBoundPickup({providerPort:{integration:'live'},pickupBinding:{}}),/sólo en DEMO/);
});
