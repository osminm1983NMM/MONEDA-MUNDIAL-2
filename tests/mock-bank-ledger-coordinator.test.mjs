import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockBankLedgerCoordinator} from '../src/server/mock-bank-ledger-coordinator.mjs';
const clock=()=>1700000000000;
const make=()=>createMockBankLedgerCoordinator({webhookSecret:'demo-secret-32-characters-minimum-123',clock});
const order={origin:'US',destination:'HN',sourceCurrency:'USD',amountCents:10000,payoutMethod:'bank_account'};
test('no crea asiento antes de recibir evento de ensayo firmado',()=>{
 const m=make(),v=m.prepareDemoIntent({requestId:'mock-request-1111',order});
 assert.throws(()=>m.prepareDemoAccountingProposal(v.transferId),/Falta evento/);
 assert.equal(v.ledgerPostingAllowed,false);
 assert.equal(m.bankConnected,false);
});
test('evento firmado genera sólo propuesta ficticia y reintento no acredita dos veces',()=>{
 const m=make(),v=m.prepareDemoIntent({requestId:'mock-request-1111',order});
 const p=m.makeMockWebhook({id:'test-event-111111',transferId:v.transferId,status:'sandbox_pending'});
 assert.equal(m.receiveDemoWebhook(p).status,'sandbox_pending');
 const done=m.makeMockWebhook({id:'test-event-222222',transferId:v.transferId,status:'sandbox_completed'});
 assert.equal(m.receiveDemoWebhook(done).ledgerPostingAllowed,false);
 assert.equal(m.receiveDemoWebhook(done).duplicate,true);
 assert.equal(m.audit().length,1);
 const proposal=m.prepareDemoAccountingProposal(v.transferId);
 assert.equal(proposal.amountMinor,'10000');
 assert.equal(proposal.proposedEntries.length,2);
 assert.equal(proposal.canPostToRealLedger,false);
 assert.equal(proposal.realFundsReceived,false);
});
test('rechaza manipulación de notificación y preserva Nicaragua',()=>{
 const m=make(),v=m.prepareDemoIntent({requestId:'mock-request-nicaragua',order:{...order,destination:'NI'}});
 const event=m.makeMockWebhook({id:'test-event-333333',transferId:v.transferId,status:'sandbox_pending'});
 assert.throws(()=>m.receiveDemoWebhook({...event,rawBody:event.rawBody+'changed'}),/Firma/);
 assert.equal(v.destination,'NI');
 assert.equal(m.audit().length,0);
});
