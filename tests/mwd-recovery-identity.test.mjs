import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMwdPendingDemo} from '../src/digital-money/mwd-pending-recovery-demo.mjs';
const request={id:'11111111-1111-4111-8111-111111111111',
 type:'transfer',cents:100,code:'MWD-0123456789ABCDEF'};
const receipt='22222222-2222-4222-8222-222222222222';
const found={mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',
 requestId:request.id,operationId:receipt,kind:'transfer',
 amountCents:100,recipientCode:request.code};
const unknown={mode:'sandbox_only',realPaymentsEnabled:false,status:'unconfirmed',requestId:request.id};

test('cuenta de prueba: referencia ya procesada nunca llama el servicio de envío',async()=>{
 const calls=[];
 const rpc=async (name,params)=>{calls.push(name);return {data:found};};
 const result=await reconcileMwdPendingDemo({request,rpc,allowRetry:true});
 assert.equal(result.retried,false);
 assert.deepEqual(calls,['mwd_operation_status_demo']);
});
test('cuenta de prueba: pérdida de respuesta conserva la misma referencia',async()=>{
 const calls=[];
 const rpc=async(name,params)=>{
  calls.push({name,params});
  if(calls.length===1)return {data:unknown};
  if(calls.length===2)return {data:{status:'already_processed',operation_id:receipt}};
  return {data:found};
 };
 const result=await reconcileMwdPendingDemo({request,rpc,allowRetry:true});
 assert.equal(result.operationId,receipt);
 assert.deepEqual(calls.map(v=>v.name),['mwd_operation_status_demo','mwd_transfer_demo','mwd_operation_status_demo']);
 assert.equal(calls[1].params.p_request_id,request.id);
 assert.equal(calls[1].params.p_amount_cents,request.cents);
 assert.equal(calls[1].params.p_recipient_code,request.code);
});
test('cambio de sesión interrumpe el flujo sin nuevo envío',async()=>{
 let owner=true; const calls=[];
 const rpc=async(name)=>{
  calls.push(name);owner=false;return {data:unknown};
 };
 await assert.rejects(reconcileMwdPendingDemo({request,rpc,allowRetry:true,isCurrent:()=>owner}));
 assert.deepEqual(calls,['mwd_operation_status_demo']);
});
