import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmAndReconcileDemo} from '../src/digital-money/demo-confirm-and-reconcile.mjs';

const quoteId='123e4567-e89b-42d3-a456-426614174000';
const conversionId='223e4567-e89b-42d3-a456-426614174000';
const quote={status:'quoted',provider:'synthetic_sandbox',quoteId,
 fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,amountOutMicro:124687,
 feeOutMicro:313,expiresAt:'2026-10-19T14:00:00Z',realPaymentsEnabled:false,priceIsReal:false};
const receipt={status:'ok',quoteId,conversionId,fromAsset:'COIN',toAsset:'STABLE',
 amountInMicro:1000000,amountOutMicro:124687,feeOutMicro:313,realPaymentsEnabled:false};
const settled={mode:'sandbox_only',realPaymentsEnabled:false,status:'executed',quoteId,
 fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,amountOutMicro:124687,
 feeOutMicro:313,conversionId};

test('confirma UNA vez y concilia el mismo recibo antes de liberar una operación ficticia',async()=>{
 const calls=[];
 const rpc=async(name,params)=>{calls.push({name,params});return {data:calls.length===1?receipt:settled};};
 assert.deepEqual(await confirmAndReconcileDemo({quote,rpc}),{status:'executed',conversionId});
 assert.deepEqual(calls.map(x=>x.name),['mwd_conversion_confirm_demo','mwd_conversion_reconcile_demo']);
 assert.deepEqual(calls.map(x=>x.params),[{p_quote_id:quoteId},{p_quote_id:quoteId}]);
});
test('recibo de ejecución previa requiere exactamente la misma conciliación',async()=>{
 const rpc=async name=>({data:name==='mwd_conversion_confirm_demo'
   ? {status:'already_processed',quoteId,conversionId,realPaymentsEnabled:false}:settled});
 assert.equal((await confirmAndReconcileDemo({quote,rpc})).conversionId,conversionId);
});
test('si internet se pierde después de confirmar, no existe éxito verificado',async()=>{
 const calls=[];
 const rpc=async name=>{calls.push(name);if(calls.length===1)return {data:receipt};throw new Error('sin red');};
 await assert.rejects(confirmAndReconcileDemo({quote,rpc}),/sin red/);
 assert.deepEqual(calls,['mwd_conversion_confirm_demo','mwd_conversion_reconcile_demo']);
});
test('no acepta ids incompatibles ni saldo, comisión o referencia falsa',async()=>{
 for(const mismatch of [
   {...settled,conversionId:'323e4567-e89b-42d3-a456-426614174000'},
   {...settled,amountOutMicro:124688},{...settled,feeOutMicro:999},
   {...settled,quoteId:'323e4567-e89b-42d3-a456-426614174000'},
   {...settled,realPaymentsEnabled:true},{...settled,status:'quoted',conversionId:null},
 ]){
   const rpc=async name=>({data:name==='mwd_conversion_confirm_demo'?receipt:mismatch});
   await assert.rejects(confirmAndReconcileDemo({quote,rpc}),/no coinciden/);
 }
});
test('si cambia la cuenta durante el primer RPC no consulta ni limpia',async()=>{
 let active=true;const calls=[];
 const rpc=async name=>{calls.push(name);active=false;return {data:receipt};};
 await assert.rejects(confirmAndReconcileDemo({quote,rpc,isCurrent:()=>active}),/cambió/);
 assert.deepEqual(calls,['mwd_conversion_confirm_demo']);
});
test('referencia no verificable no hace llamadas al servidor',async()=>{
 let count=0;
 await assert.rejects(confirmAndReconcileDemo({quote:{...quote,realPaymentsEnabled:true},rpc:async()=>{count++}}),/inválida/);
 assert.equal(count,0);
});
