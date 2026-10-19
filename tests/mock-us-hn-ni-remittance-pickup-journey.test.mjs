// Cadena de laboratorio completa: remesa US -> Honduras (NI también) + retiro ficticio.
// Todas las llamadas son en RAM sin red, bancos, fondos, proveedor real o PII.
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockProviderIntegrationPort} from '../src/server/provider-integration-port.mjs';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockCashPickupVerifier} from '../src/server/mock-cash-pickup-verification.mjs';
import {createMockAgentPickupSession} from '../src/server/mock-agent-pickup-session.mjs';
import {createMockPickupBinding} from '../src/server/mock-pickup-binding.mjs';

const CLOCK=1700000000000;
const US_SECRET='LABORATORIO-provider-mock-2026-secret-00001';
const PICKUP_SECRET='LABORATORIO-pickup-mock-2026-secret-00002';
const keys=generateKeyPairSync('ed25519');
const pem=keys.publicKey.export({type:'spki',format:'pem'});
const privateKey=keys.privateKey;
const order=destination=>({origin:'US',destination,sourceCurrency:'USD',
 amountCents:10000,payoutMethod:'cash_pickup'});
const makePort=()=>createMockProviderIntegrationPort({webhookSecret:US_SECRET,
 clock:()=>CLOCK,countryCodes:['HN','NI']});
const makeGateway=()=>createMockInstitutionSessionGateway({clock:()=>CLOCK,members:[
 {memberId:'staff-hn-test-001',institutionId:'agent-hn',state:'active_mock',publicKeyPem:pem},
 {memberId:'staff-ni-test-001',institutionId:'agent-ni',state:'active_mock',publicKeyPem:pem},
 {memberId:'staff-hn-bank-01',institutionId:'bank-hn',state:'active_mock',publicKeyPem:pem},
]});
const login=(gateway,id)=>{
 const challenge=gateway.beginMockChallenge({memberId:id});
 return gateway.completeMockChallenge({memberId:id,challengeId:challenge.challengeId,
  signatureBase64url:sign(null,Buffer.from(challenge.signedMessage),privateKey).toString('base64url')}).sessionToken;
};
function assertNoReal(r){
 for(const key of ['canPay','realMoneyEnabled','moneyDelivered','realIdentityConfirmed',
    'recipientPaid','fundingConfirmed','providerConnected','bankProviderConnected',
    'payoutSettled','fundsSettled','redeemableAtAnyAgent','payoutOccurred',
    'identityCheckedByProvider'])if(Object.hasOwn(r,key))assert.equal(r[key],false,key);
}
test('Estados Unidos → Honduras: orden y estados MOCK no acreditan un solo centavo',()=>{
 const port=makePort(),q=port.getNonExecutableQuote(order('HN'));
 assert.equal(q.route,'US:HN');
 assert.equal(q.fxRate,null);
 assert.equal(q.recipientAmountCents,null);
 assert.equal(q.feeCents,null);
 assert.equal(q.executable,false);
 assertNoReal(q);
 const input={requestId:'US-HN-MOCK-TRANSFER-001',order:order('HN')};
 const first=port.submitDemoTransfer(input);
 assert.equal(first.alreadyProcessed,false);
 assertNoReal(first);
 const event=port.makeSyntheticEvent({id:'US-HN-MOCK-EVENT-001',
  transferId:first.demoTransferId,status:'sandbox_pending'});
 assert.equal(port.receiveSignedDemoEvent(event).stage,'processing_mock_provider_only');
 assert.equal(port.receiveSignedDemoEvent(event).alreadyProcessed,true);
 const done=port.makeSyntheticEvent({id:'US-HN-MOCK-EVENT-002',
  transferId:first.demoTransferId,status:'sandbox_completed'});
 const completion=port.receiveSignedDemoEvent(done);
 assert.equal(completion.stage,'mock_provider_job_completed_unverified');
 assertNoReal(completion);
 const replay=port.submitDemoTransfer(input);
 assert.equal(replay.alreadyProcessed,true);
 assert.equal(replay.demoTransferId,first.demoTransferId);
 assert.equal(replay.stage,'mock_provider_job_completed_unverified');
 const status=port.checkDemoStatus(first.demoTransferId);
 assert.equal(status.noConfirmedFunding,true);
 assert.equal(status.noConfirmedDisbursement,true);
 assert.equal(status.journalPostingAllowed,false);
 assertNoReal(status);
 assert.equal(port.sanitizedAudit().filter(x=>x.type==='mock_transfer_created').length,1);
 assert.equal(replay.funded,false);
 assert.equal(replay.paid,false);
 assert.equal(replay.realMoneyEnabled,false);
});
test('Honduras: el agente NI o banco HN no pueden consumir código SAMPLE',()=>{
 const verifier=createMockCashPickupVerifier({secret:PICKUP_SECRET,clock:()=>CLOCK});
 const g=makeGateway(),agent=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:verifier});
 const caseId='SIM-HN-CASEONE001',beneficiaryAlias='SAMPLE-HN-ALIASONE001';
 const sample=verifier.createSample({caseId,beneficiaryAlias,country:'HN',amountCents:10000});
 const input={caseId,beneficiaryAlias,sampleCode:sample.sampleCode};
 for(const memberId of ['staff-ni-test-001','staff-hn-bank-01']){
  const token=login(g,memberId);
  const rejected=agent.verifySample({...input,sessionToken:token});
  assert.equal(rejected.acceptedMock,false);
  assertNoReal(rejected);
  assert.equal(verifier.inspectSample(caseId).failedAttempts,0);
 }
 const auth=login(g,'staff-hn-test-001');
 assert.equal(g.logoutMockSession({sessionToken:auth}).revoked,true);
 assert.equal(agent.verifySample({...input,sessionToken:auth}).acceptedMock,false);
 assert.equal(verifier.inspectSample(caseId).status,'issued_mock');
 const valid=login(g,'staff-hn-test-001');
 const checked=agent.verifySample({...input,sessionToken:valid});
 assert.equal(checked.acceptedMock,true);
 assert.equal(checked.status,'consumed_mock');
 assertNoReal(checked);
 const duplicate=agent.verifySample({...input,sessionToken:valid});
 assert.equal(duplicate.acceptedMock,false);
 assertNoReal(duplicate);
 assert.equal(JSON.stringify(verifier.sanitizedAudit()).includes(sample.sampleCode),false);
 assert.equal(JSON.stringify(verifier.inspectSample(caseId)).includes(sample.sampleCode),false);
});
test('Nicaragua se conserva como ruta DEMO, siempre sin fondos ni pago',()=>{
 const port=makePort(),verifier=createMockCashPickupVerifier({secret:PICKUP_SECRET,clock:()=>CLOCK});
 const input={requestId:'US-NI-MOCK-TRANSFER-001',order:order('NI')};
 assert.equal(port.getNonExecutableQuote(input.order).route,'US:NI');
 const transfer=port.submitDemoTransfer(input);
 assert.equal(port.checkDemoStatus(transfer.demoTransferId).bankProviderConnected,false);
 const g=makeGateway(),agent=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:verifier});
 const alias='SAMPLE-NI-ALIASSAMPLE01';
 const item=verifier.createSample({caseId:'SIM-NI-CASEDEMO001',
  beneficiaryAlias:alias,country:'NI',amountCents:10000});
 const checked=agent.verifySample({sessionToken:login(g,'staff-ni-test-001'),
   caseId:item.caseId,sampleCode:item.sampleCode,beneficiaryAlias:alias});
 assert.equal(checked.acceptedMock,true);
 assertNoReal(checked);
 assert.equal(port.sanitizedAudit().filter(x=>x.type==='mock_transfer_created').length,1);
});
// IMPORTANTE: todo el flujo, incluida la prueba enlazada, es puramente MOCK.
// Ninguna fase confirma financiación o entrega bancaria real.

test('Honduras: flujo MOCK enlazado desde remesa hasta verificación del agente',()=>{
 const port=makePort(),verifier=createMockCashPickupVerifier({secret:PICKUP_SECRET,clock:()=>CLOCK});
 const binding=createMockPickupBinding({providerPort:port,pickupVerifier:verifier});
 const g=makeGateway(),agent=createMockAgentPickupSession({sessionGateway:g,pickupVerifier:verifier});
 const transfer=port.submitDemoTransfer({requestId:'US-HN-BIND-FULL-JOURNEY-001',order:order('HN')});
 const ref={demoTransferId:transfer.demoTransferId,caseId:'SIM-HN-FULLCHAIN001',
  beneficiaryAlias:'SAMPLE-HN-FULLCHAIN001'};
 // No existe un código de retiro mientras la simulación está pendiente.
 assert.throws(()=>binding.issueSyntheticPickup(ref),/no apta/);
 const pending=port.makeSyntheticEvent({id:'US-HN-BIND-PENDING-001',
  transferId:transfer.demoTransferId,status:'sandbox_pending'});
 port.receiveSignedDemoEvent(pending);
 assert.throws(()=>binding.issueSyntheticPickup(ref),/no apta/);
 const done=port.makeSyntheticEvent({id:'US-HN-BIND-COMPLETE-001',
  transferId:transfer.demoTransferId,status:'sandbox_completed'});
 port.receiveSignedDemoEvent(done);
 const sample=binding.issueSyntheticPickup(ref);
 assert.equal(sample.destination,'HN');
 assert.equal(sample.proofOfPayment,false);
 assert.equal(sample.canRedeemAtBank,false);
 assert.match(sample.sampleCode,/^SIMONLY-[A-F0-9]{32}$/);
 const mockCheck={caseId:ref.caseId,beneficiaryAlias:ref.beneficiaryAlias,
  sampleCode:sample.sampleCode};
 // Una institución de otro país no consume el SAMPLE ficticio.
 const foreign=agent.verifySample({...mockCheck,
  sessionToken:login(g,'staff-ni-test-001')});
 assert.equal(foreign.acceptedMock,false);
 assert.equal(verifier.inspectSample(ref.caseId).failedAttempts,0);
 const accepted=agent.verifySample({...mockCheck,
  sessionToken:login(g,'staff-hn-test-001')});
 assert.equal(accepted.acceptedMock,true);
 assert.equal(accepted.status,'consumed_mock');
 assertNoReal(accepted);
 assert.equal(accepted.canPay,false);
 const replay=binding.issueSyntheticPickup(ref);
 assert.equal(replay.alreadyIssued,true);
 assert.equal(Object.hasOwn(replay,'sampleCode'),false);
 const inspected=binding.inspectSyntheticPickup({demoTransferId:transfer.demoTransferId});
 assert.equal(inspected.codeStatus,'consumed_mock');
 assert.equal(JSON.stringify(inspected).includes(sample.sampleCode),false);
 assert.equal(JSON.stringify(verifier.sanitizedAudit()).includes(sample.sampleCode),false);
 assert.equal(port.checkDemoStatus(transfer.demoTransferId).noConfirmedFunding,true);
 assert.equal(port.checkDemoStatus(transfer.demoTransferId).noConfirmedDisbursement,true);
 assert.equal(port.sanitizedAudit().filter(x=>x.type==='mock_transfer_created').length,1);
});
