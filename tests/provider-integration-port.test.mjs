import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockProviderIntegrationPort,PROVIDER_API_PORT_CONTRACT} from '../src/server/provider-integration-port.mjs';
const secret='sandbox-fixture-secret-for-integration-123456789';
const make=()=>createMockProviderIntegrationPort({webhookSecret:secret,clock:()=>1700000000000});
const order={origin:'US',destination:'HN',sourceCurrency:'USD',amountCents:10000,payoutMethod:'cash_pickup'};
test('port de integración no puede transmitir dinero ni generar cotizaciones bancarias',()=>{
 const p=make(),q=p.getNonExecutableQuote(order);
 assert.equal(p.realFundsEnabled,false);
 assert.equal(q.feeCents,null);assert.equal(q.executable,false);
 assert.equal(PROVIDER_API_PORT_CONTRACT.officialSandboxConnected,false);
 assert.throws(()=>createMockProviderIntegrationPort({mode:'live',webhookSecret:secret}),/DESHABILITADA/);
 assert.throws(()=>createMockProviderIntegrationPort({webhookSecret:secret,url:'https://example.org'}),/No se permiten/);
});
test('notificaciones firmadas sólo señalan estados del MOCK: no se equiparan a fondeo o entrega',()=>{
 const p=make();const t=p.submitDemoTransfer({requestId:'request-test-123456',order});
 const pending=p.makeSyntheticEvent({id:'event-pending-12345',transferId:t.demoTransferId,status:'sandbox_pending'});
 assert.equal(p.receiveSignedDemoEvent(pending).fundsSettled,false);
 const done=p.makeSyntheticEvent({id:'event-complete-12345',transferId:t.demoTransferId,status:'sandbox_completed'});
 assert.equal(p.receiveSignedDemoEvent(done).payoutSettled,false);
 assert.equal(p.receiveSignedDemoEvent(done).alreadyProcessed,true);
 assert.equal(p.checkDemoStatus(t.demoTransferId).journalPostingAllowed,false);
 assert.equal(p.sanitizedAudit().length,3);
});
test('firma alterada, esquema inseguro, países deshabilitados y referencias desconocidas se rechazan',()=>{
 const p=make(),t=p.submitDemoTransfer({requestId:'request-test-223456',order});
 const e=p.makeSyntheticEvent({id:'event-tamper-12345',transferId:t.demoTransferId,status:'sandbox_pending'});
 assert.throws(()=>p.receiveSignedDemoEvent({...e,rawBody:e.rawBody+' '}),/Firma/);
 assert.throws(()=>p.submitDemoTransfer({requestId:'request-test-323456',order:{...order,beneficiaryName:'test'}}),/mínimos/);
 assert.throws(()=>p.getNonExecutableQuote({...order,destination:'CR'}),/Ruta/);
 assert.throws(()=>p.checkDemoStatus('unknown'),/desconocida/);
});
test('Nicaragua permanece en simulación y reintentos no duplican orden',()=>{
 const p=make(),n={...order,destination:'NI'};
 const first=p.submitDemoTransfer({requestId:'request-nicaragua-12345',order:n});
 const again=p.submitDemoTransfer({requestId:'request-nicaragua-12345',order:n});
 assert.equal(first.demoTransferId,again.demoTransferId);
 assert.equal(again.alreadyProcessed,true);
 assert.equal(p.checkDemoStatus(first.demoTransferId).destination,'NI');
});
