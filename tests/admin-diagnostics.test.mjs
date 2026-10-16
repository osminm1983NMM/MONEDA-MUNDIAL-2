import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_READ_ONLY_CHECKS,runAdminReadOnlyChecks,summarizeAdminDiagnostic,classifyAdminDiagnosticError} from '../src/admin-diagnostics.mjs';
test('diagnóstico llama solamente RPC de consulta y no modifica saldos',async()=>{
 const called=[];
 const results=await runAdminReadOnlyChecks(async(name,args)=>{
  called.push({name,args});
  return {data:[]};
 });
 assert.equal(called.length,4);
 assert.deepEqual(called.map(x=>x.name),OWNER_READ_ONLY_CHECKS.map(x=>x.rpc));
 assert.ok(called.every(x=>!/(transfer|save|update|pay|cancel|contribute)/i.test(x.name)));
 assert.ok(results.every(x=>x.status==='disponible'&&x.count===0));
});
test('servicio opcional no disponible se informa como pendiente',async()=>{
 const r=await runAdminReadOnlyChecks(async name=>name==='mwd_owner_partner_activities_demo'?
  {error:{code:'PGRST202',message:'not found'}}:{data:[{}]});
 assert.equal(r.find(x=>x.id==='agenda').status,'pendiente');
 assert.equal(r.find(x=>x.id==='partners').count,1);
});
test('respuestas inválidas no parecen exitosas',()=>{
 const check=OWNER_READ_ONLY_CHECKS[0];
 assert.equal(summarizeAdminDiagnostic(check,{data:{x:1}}).status,'error');
 assert.equal(summarizeAdminDiagnostic({id:'fake',rpc:'unsafe'},{data:[]}).status,'error');
});

test('sin permiso y sesión caducada no se confunden con módulo pendiente', async () => {
 const denied=await runAdminReadOnlyChecks(async () => ({error:{code:'42501',message:'SQL privado'}}));
 assert.ok(denied.every(x=>x.status==='sin_permiso' && x.count===null));
 const session=classifyAdminDiagnosticError(OWNER_READ_ONLY_CHECKS[3], {status:401});
 assert.equal(session,'sin_permiso');
});
test('caída de red y errores SQL inesperados no aparentan función ausente',async()=>{
 const failed=await runAdminReadOnlyChecks(async()=>{throw new TypeError('Network request failed');});
 assert.ok(failed.every(x=>x.status==='error'&&x.count===null));
 const optional=OWNER_READ_ONLY_CHECKS[3];
 assert.equal(classifyAdminDiagnosticError(optional,{code:'42P01',message:'error SQL interno'}),'error');
 assert.equal(classifyAdminDiagnosticError(optional,{code:'42883'}),'pendiente');
 assert.equal(classifyAdminDiagnosticError(OWNER_READ_ONLY_CHECKS[0],{code:'PGRST202'}),'error');
});
test('respuestas sin información siguen siendo lecturas válidas',()=>{
 assert.deepEqual(summarizeAdminDiagnostic(OWNER_READ_ONLY_CHECKS[0],{data:[]}),{status:'disponible',count:0});
});
