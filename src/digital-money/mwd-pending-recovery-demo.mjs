// Orquestación SOLO DEMO de una operación MWD incierta.
// Consultar primero; reintentar únicamente con idéntico request_id, importe y destino.
// No usar este flujo para dinero real ni como sustituto de un libro bancario.
import {buildMwdDemoRetry} from './mwd-pending-operation-demo.mjs';
import {classifyMwdOperationStatus} from './mwd-operation-status-demo.mjs';

export async function reconcileMwdPendingDemo({request,rpc,allowRetry=false,isCurrent=()=>true}){
 const retry=buildMwdDemoRetry(request);
 if(!retry||typeof rpc!=='function'||typeof isCurrent!=='function')
   throw new Error('Referencia ficticia o conexión inválida');
 const assertCurrent=()=>{
   if(!isCurrent())throw new Error('La sesión cambió; se detuvo la conciliación');
 };
 async function status(){
   assertCurrent();
   const result=await rpc('mwd_operation_status_demo',{p_request_id:request.id});
   assertCurrent();
   if(result?.error)throw result.error;
   const state=classifyMwdOperationStatus(result?.data,request);
   if(!state)throw new Error('Respuesta de conciliación no verificable');
   return {state,data:result.data};
 }
 const before=await status();
 if(before.state==='processed')return {state:'processed',operationId:before.data.operationId,retried:false};
 if(!allowRetry)return {state:'unconfirmed',retried:false};
 assertCurrent(); // Nunca iniciar un reintento si la sesión cambió tras consultar.
 const repeated=await rpc(retry.rpc,retry.params);
 assertCurrent();
 if(repeated?.error)throw repeated.error;
 if(!['ok','already_processed'].includes(repeated?.data?.status))
   throw new Error('Recibo del reintento no verificable');
 const after=await status();
 if(after.state!=='processed'||after.data.operationId!==repeated.data.operation_id)
   throw new Error('Recibo y libro de operaciones ficticias no coinciden');
 return {state:'processed',operationId:after.data.operationId,retried:true};
}
