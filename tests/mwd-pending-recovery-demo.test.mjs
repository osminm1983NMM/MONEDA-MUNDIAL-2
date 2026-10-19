import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMwdPendingDemo} from '../src/digital-money/mwd-pending-recovery-demo.mjs';
const req={id:'11111111-1111-4111-8111-111111111111',type:'transfer',cents:100,code:'MWD-0123456789ABCDEF'};
const opId='22222222-2222-4222-8222-222222222222';
const processed={mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',requestId:req.id,
 operationId:opId,kind:'transfer',amountCents:100,recipientCode:req.code};
const unconfirmed={mode:'sandbox_only',realPaymentsEnabled:false,status:'unconfirmed',requestId:req.id};
test('no reenvía operación que ya está registrada',async()=>{
 const calls=[];
 const rpc=async(name,params)=>{calls.push([name,params]);return {data:processed};};
 assert.deepEqual(await reconcileMwdPendingDemo({request:req,rpc,allowRetry:true}),
  {state:'processed',operationId:opId,retried:false});
 assert.equal(calls.length,1);
});
test('consulta sin reintentar cuando aún no hay registro',async()=>{
 let count=0;
 const result=await reconcileMwdPendingDemo({request:req,rpc:async()=>{count++;return {data:unconfirmed};}});
 assert.equal(result.state,'unconfirmed');assert.equal(count,1);
});
test('repite misma referencia y verifica el recibo',async()=>{
 const calls=[];
 const rpc=async(name,params)=>{
  calls.push([name,params]);
  if(calls.length===1)return {data:unconfirmed};
  if(calls.length===2)return {data:{status:'already_processed',operation_id:opId}};
  return {data:processed};
 };
 const result=await reconcileMwdPendingDemo({request:req,rpc,allowRetry:true});
 assert.equal(result.retried,true);
 assert.equal(calls[1][0],'mwd_transfer_demo');
 assert.deepEqual(calls[1][1],{p_recipient_code:req.code,p_amount_cents:100,p_request_id:req.id});
});
test('rechaza recibo incompatible y cancela cuando cambia la sesión',async()=>{
 await assert.rejects(reconcileMwdPendingDemo({request:req,allowRetry:true,rpc:async(name)=>{
   return {data:name==='mwd_operation_status_demo'?unconfirmed:{status:'ok',operation_id:'33333333-3333-4333-8333-333333333333'}};
 }}));
 let current=true;let count=0;
 await assert.rejects(reconcileMwdPendingDemo({request:req,allowRetry:true,isCurrent:()=>current,rpc:async()=>{count++;current=false;return {data:unconfirmed};}}));
 assert.equal(count,1);
});
