import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMwdPendingDemo} from '../src/digital-money/mwd-pending-recovery-demo.mjs';

const request={id:'11111111-1111-4111-8111-111111111111',
 type:'transfer',cents:100,code:'MWD-BBBBBBBBBBBBBBBB'};
const receiptId='22222222-2222-4222-8222-222222222222';

function sandbox(){
 const balances={a:100000,b:200000};
 const records=new Map();
 const status=(user)=>records.get(user+'|'+request.id);
 const rpcFor=user=>async(name,params)=>{
   if(name==='mwd_operation_status_demo'){
     const existing=status(user);
     return {data:existing?{
       mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',
       requestId:request.id,operationId:existing.id,kind:'transfer',
       amountCents:existing.amount,recipientCode:existing.code,
     }:{mode:'sandbox_only',realPaymentsEnabled:false,status:'unconfirmed',
       requestId:request.id}};
   }
   if(name!=='mwd_transfer_demo'||user!=='a')throw Error('Unauthorized sandbox operation');
   if(params.p_request_id!==request.id||params.p_recipient_code!==request.code||
      params.p_amount_cents!==request.cents)throw Error('Wrong original request');
   let row=status('a');
   if(row)return {data:{status:'already_processed',operation_id:row.id}};
   balances.a-=request.cents;balances.b+=request.cents;
   row={id:receiptId,amount:request.cents,code:request.code};
   records.set('a|'+request.id,row);
   return {data:{status:'ok',operation_id:receiptId}};
 };
 return {balances,records,rpcFor};
}

test('sandbox de dos usuarios: reintentar la referencia no duplica saldo',async()=>{
 const service=sandbox();
 const first=await reconcileMwdPendingDemo({
   request,rpc:service.rpcFor('a'),allowRetry:true
 });
 assert.equal(first.state,'processed');
 assert.equal(first.retried,true);
 const again=await reconcileMwdPendingDemo({
   request,rpc:service.rpcFor('a'),allowRetry:true
 });
 assert.equal(again.state,'processed');
 assert.equal(again.retried,false);
 assert.deepEqual(service.balances,{a:99900,b:200100});
 assert.equal(service.records.size,1);
});
test('sandbox de dos usuarios: otra cuenta no obtiene recibo ajeno',async()=>{
 const service=sandbox();
 await reconcileMwdPendingDemo({request,rpc:service.rpcFor('a'),allowRetry:true});
 const other=await reconcileMwdPendingDemo({
   request,rpc:service.rpcFor('b'),allowRetry:false
 });
 assert.equal(other.state,'unconfirmed');
 assert.equal(service.records.size,1);
});
