// SOLO DEMO: recuperación de una confirmación incierta mediante lectura única.
// La consulta nunca vuelve a ejecutar mwd_conversion_confirm_demo ni crea otra cotización.
// NO confirma fondos de bancos ni valores negociables; el servidor debe aplicar RLS/RPC.
import {decodePendingDemoQuote,classifyDemoReconciliation} from './demo-pending-confirmation.mjs';

export async function inspectPendingConversionDemo({
 pending,rpc,isCurrent=()=>true
}={}){
 if(!pending||pending.unavailable||typeof rpc!=='function'||
    typeof isCurrent!=='function')
   throw new Error('Confirmación pendiente de prueba inválida');
 let verified;
 try{
  verified=decodePendingDemoQuote(JSON.stringify({
   ...pending,version:1,mode:'sandbox_only'
  }));
 }catch{
  verified=null;
 }
 if(!verified)throw new Error('Referencia pendiente de prueba no verificable');
 const ensureCurrent=()=>{
  if(!isCurrent())
   throw new Error('La sesión cambió durante la conciliación; conservar pendiente');
 };
 ensureCurrent();
 const result=await rpc('mwd_conversion_reconcile_demo',{p_quote_id:verified.quoteId});
 ensureCurrent();
 if(!result||result.error)throw new Error('No se pudo consultar la conciliación de prueba');
 const state=classifyDemoReconciliation(result.data,verified);
 if(!state)throw new Error('Conciliación de prueba no verificable; conservar pendiente');
 return Object.freeze({
  status:state,quoteId:verified.quoteId,
  conversionId:state==='executed'?result.data.conversionId:null,
  realPaymentsEnabled:false,operationRepeated:false,
 });
}
