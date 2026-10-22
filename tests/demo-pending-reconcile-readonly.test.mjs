import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPendingConversionDemo} from '../src/digital-money/demo-pending-reconcile-readonly.mjs';
const q='123e4567-e89b-42d3-a456-426614174000';
const c='223e4567-e89b-42d3-a456-426614174000';
const pending={quoteId:q,fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,
 amountOutMicro:124687,feeOutMicro:313,expiresAt:'2026-10-22T20:00:00Z',
 realPaymentsEnabled:false};
const response={mode:'sandbox_only',realPaymentsEnabled:false,quoteId:q,
 fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,amountOutMicro:124687,
 feeOutMicro:313,status:'executed',conversionId:c};
test('conciliación recupera ejecución con una sola consulta sin confirmar otra vez',async()=>{
 const calls=[];
 const v=await inspectPendingConversionDemo({pending,rpc:async(name,params)=>{
  calls.push({name,params});return {data:response};
 }});
 assert.deepEqual(calls,[{name:'mwd_conversion_reconcile_demo',params:{p_quote_id:q}}]);
 assert.deepEqual(v,{status:'executed',quoteId:q,conversionId:c,
  realPaymentsEnabled:false,operationRepeated:false});
});
test('cotización quoted o expired no simula desembolso',async()=>{
 for(const status of ['quoted','expired']){
  const v=await inspectPendingConversionDemo({pending,
   rpc:async()=>({data:{...response,status,conversionId:null}})});
  assert.equal(v.status,status);
  assert.equal(v.conversionId,null);
 }
});
test('sin red, respuesta adulterada y pendiente malformada no producen éxito',async()=>{
 await assert.rejects(inspectPendingConversionDemo({pending,rpc:async()=>{throw new Error('sin red')}}),/sin red/);
 await assert.rejects(inspectPendingConversionDemo({pending,rpc:async()=>({error:{message:'offline'}})}),/No se pudo/);
 for(const data of [{...response,amountOutMicro:12},{...response,quoteId:c},
                   {...response,realPaymentsEnabled:true},{...response,status:'paid'}]){
  await assert.rejects(inspectPendingConversionDemo({pending,rpc:async()=>({data})}),/no verificable/);
 }
 let requests=0;
 await assert.rejects(inspectPendingConversionDemo({pending:{...pending,realPaymentsEnabled:true},
  rpc:async()=>{requests++;return {data:response}}}),/no verificable/);
 assert.equal(requests,0);
});
test('cambio de sesión mientras consulta cancela la aceptación de la respuesta',async()=>{
 let active=true;
 const calls=[];
 await assert.rejects(inspectPendingConversionDemo({
  pending,rpc:async(name)=>{calls.push(name);active=false;return {data:response}},
  isCurrent:()=>active
 }),/sesión cambió/);
 assert.deepEqual(calls,['mwd_conversion_reconcile_demo']);
});
test('sesión obsoleta desde el inicio no hace RPC',async()=>{
 let called=false;
 await assert.rejects(inspectPendingConversionDemo({
  pending,rpc:async()=>{called=true},isCurrent:()=>false
 }),/sesión cambió/);
 assert.equal(called,false);
});
