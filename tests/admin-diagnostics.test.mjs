import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OWNER_READ_ONLY_CHECKS,runAdminReadOnlyChecks,summarizeAdminDiagnostic} from '../src/admin-diagnostics.mjs';
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
  {error:{message:'not found'}}:{data:[{}]});
 assert.equal(r.find(x=>x.id==='agenda').status,'pendiente');
 assert.equal(r.find(x=>x.id==='partners').count,1);
});
test('respuestas inválidas no parecen exitosas',()=>{
 const check=OWNER_READ_ONLY_CHECKS[0];
 assert.equal(summarizeAdminDiagnostic(check,{data:{x:1}}).status,'error');
 assert.equal(summarizeAdminDiagnostic({id:'fake',rpc:'unsafe'},{data:[]}).status,'error');
});
