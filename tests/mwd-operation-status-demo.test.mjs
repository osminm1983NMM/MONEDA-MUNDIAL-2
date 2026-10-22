import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMwdOperationStatus} from '../src/digital-money/mwd-operation-status-demo.mjs';
const request={id:'11111111-1111-4111-8111-111111111111',type:'transfer',cents:100,code:'MWD-0123456789ABCDEF'};
const response={mode:'sandbox_only',realPaymentsEnabled:false,requestId:request.id,status:'processed',operationId:'22222222-2222-4222-8222-222222222222',kind:'transfer',amountCents:100,recipientCode:request.code};
test('validar respuesta de consulta y señalar estado aun no confirmado',()=>{
 assert.equal(classifyMwdOperationStatus(response,request),'processed');
 assert.equal(classifyMwdOperationStatus({mode:'sandbox_only',realPaymentsEnabled:false,requestId:request.id,status:'unconfirmed'},request),'unconfirmed');
 for(const change of [{requestId:'wrong'},{realPaymentsEnabled:true},{mode:'live'},{amountCents:101},{recipientCode:'MWD-FFFFFFFFFFFFFFFF'},{operationId:'bad'},{kind:'contribution'},{status:'unknown'}]){
  assert.equal(classifyMwdOperationStatus({...response,...change},request),null);
 }
});
test('aportación exige beneficiario nulo',()=>{
 const req={...request,type:'contribution',code:''};
 assert.equal(classifyMwdOperationStatus({...response,kind:'contribution',recipientCode:null},req),'processed');
 assert.equal(classifyMwdOperationStatus({...response,kind:'contribution'},req),null);
});

test('rechaza estado pendiente contradictorio para impedir reenvío',()=>{
 for(const patch of [{operationId:response.operationId},{kind:'transfer'},{amountCents:100},{recipientCode:request.code}]){
  assert.equal(classifyMwdOperationStatus({mode:'sandbox_only',realPaymentsEnabled:false,requestId:request.id,status:'unconfirmed',...patch},request),null);
 }
});
