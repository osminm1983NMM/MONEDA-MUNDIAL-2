import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockProviderIntegrationPort} from '../src/server/provider-integration-port.mjs';
import {createMockCashPickupVerifier} from '../src/server/mock-cash-pickup-verification.mjs';
import {createMockPickupBinding} from '../src/server/mock-pickup-binding.mjs';
const T=1700000000000;
const secret='abc123-sandbox-pickup-for-tests-2026-only';
const make=()=>{
 const port=createMockProviderIntegrationPort({webhookSecret:secret,clock:()=>T,countryCodes:['HN','NI']});
 const verifier=createMockCashPickupVerifier({secret,clock:()=>T,countryCodes:['HN','NI']});
 return {port,verifier,binding:createMockPickupBinding({providerPort:port,pickupVerifier:verifier})};
};
const order=(destination='HN',payoutMethod='cash_pickup')=>({
 origin:'US',destination,sourceCurrency:'USD',amountCents:10000,payoutMethod
});
const create=(port,destination='HN',payoutMethod='cash_pickup')=>port.submitDemoTransfer({
 requestId:'request-'+destination+'-'+payoutMethod+'-001',order:order(destination,payoutMethod)
});
const complete=(port,id)=>{
 const pending=port.makeSyntheticEvent({id:'mock-event-pending-'+id,
   transferId:id,status:'sandbox_pending'});
 const done=port.makeSyntheticEvent({id:'mock-event-finished-'+id,
   transferId:id,status:'sandbox_completed'});
 port.receiveSignedDemoEvent(pending);
 port.receiveSignedDemoEvent(done);
};
const input=(id,country='HN')=>({
 demoTransferId:id,caseId:'SIM-'+country+'-ABCD123456',
 beneficiaryAlias:'SAMPLE-'+country+'-ALIAS123456'
});
test('sin terminar remesa MOCK no se emite ni siquiera un código SAMPLE',()=>{
 const {port,binding,verifier}=make();
 const r=create(port);
 assert.throws(()=>binding.issueSyntheticPickup(input(r.demoTransferId)),/no apta/);
 assert.equal(binding.inspectSyntheticPickup({demoTransferId:r.demoTransferId}),null);
 assert.equal(verifier.sanitizedAudit().length,0);
});
test('US→HN muestra código SOLO UNA vez y nunca afirma dinero entregado',()=>{
 const {port,binding,verifier}=make(),r=create(port);
 complete(port,r.demoTransferId);
 const a=binding.issueSyntheticPickup(input(r.demoTransferId));
 assert.match(a.sampleCode,/^SIMONLY-[A-F0-9]{32}$/);
 assert.equal(a.realMoneyEnabled,false);assert.equal(a.proofOfPayment,false);
 assert.equal(a.bankFundingVerified,false);assert.equal(a.canRedeemAtBank,false);
 const again=binding.issueSyntheticPickup(input(r.demoTransferId));
 assert.equal(again.alreadyIssued,true);assert.equal(Object.hasOwn(again,'sampleCode'),false);
 const inspect=binding.inspectSyntheticPickup({demoTransferId:r.demoTransferId});
 assert.equal(inspect.codeStatus,'issued_mock');
 assert.equal(JSON.stringify(inspect).includes(a.sampleCode),false);
 assert.throws(()=>binding.issueSyntheticPickup({...input(r.demoTransferId),caseId:'SIM-HN-OTHERCASE12'}),/otro código/);
 const confirmation=verifier.verifySyntheticCode({caseId:a.caseId,sampleCode:a.sampleCode,
   beneficiaryAlias:'SAMPLE-HN-ALIAS123456'});
 assert.equal(confirmation.acceptedMock,true);assert.equal(confirmation.moneyDelivered,false);
 assert.equal(binding.inspectSyntheticPickup({demoTransferId:r.demoTransferId}).codeStatus,'consumed_mock');
 assert.equal(verifier.verifySyntheticCode({caseId:a.caseId,sampleCode:a.sampleCode,
   beneficiaryAlias:'SAMPLE-HN-ALIAS123456'}).acceptedMock,false);
});
test('rechaza modo banco, país cruzado, PII y suplantación de pago',()=>{
 const {port,binding,verifier}=make();
 const bank=create(port,'NI','bank_account');
 complete(port,bank.demoTransferId);
 assert.throws(()=>binding.issueSyntheticPickup(input(bank.demoTransferId,'NI')),/no apta/);
 const other=create(port,'HN');complete(port,other.demoTransferId);
 assert.throws(()=>binding.issueSyntheticPickup(input(other.demoTransferId,'NI')),/no apta/);
 for(const extra of [{cardNumber:'0000'},{paid:true},{recipientName:'SAMPLE'}, {providerApproved:true}]){
  assert.throws(()=>binding.issueSyntheticPickup({...input(other.demoTransferId),...extra}),/inválida/);
 }
 assert.equal(verifier.sanitizedAudit().length,0);
});
test('Nicaragua conserva alcance sólo de laboratorio y no se reemite código',()=>{
 const {port,binding}=make();
 const r=create(port,'NI');complete(port,r.demoTransferId);
 const a=binding.issueSyntheticPickup(input(r.demoTransferId,'NI'));
 assert.equal(a.destination,'NI');assert.equal(a.realMoneyEnabled,false);
 const again=binding.issueSyntheticPickup(input(r.demoTransferId,'NI'));
 assert.equal(again.alreadyIssued,true);
 assert.equal(again.sampleCodeRetrievable,false);
});
