import test from 'node:test';
import assert from 'node:assert/strict';
import {runDemoAccountSelfcheck} from '../src/digital-money/demo-account-selfcheck.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

function stub({actor=A, leakTable=null, missingProfile=false, failedTable=null, afterRead=null}={}){
  const db={
    mwd_wallets:[{user_id:A},{user_id:B}],
    mwd_profiles:missingProfile?[{user_id:B}]:[{user_id:A},{user_id:B}],
    mwd_admin_roles:[{user_id:A},{user_id:B}],
    mwd_merchants:[{owner_user_id:B}],
    mwd_payment_requests:[{merchant_user_id:B}],
    mwd_operations:[
      {source_user_id:A,destination_user_id:B},
      {source_user_id:B,destination_user_id:null},
    ],
  };
  const visibility=(table,row)=>{
    if (leakTable===table) return true;
    if (table==='mwd_operations') return row.source_user_id===actor||row.destination_user_id===actor;
    const column=table==='mwd_merchants'?'owner_user_id':table==='mwd_payment_requests'?'merchant_user_id':'user_id';
    return row[column]===actor;
  };
  const calls=[];
  return {calls,auth:{async getUser(){calls.push('auth');return {data:{user:{id:actor}}};}},
   from(table){const filters=[];return {
    select(){return this;},eq(field,value){filters.push(['eq',field,value]);return this;},
    neq(field,value){filters.push(['neq',field,value]);return this;},
    async limit(n){calls.push(table);if(failedTable===table)return {error:new Error('network')};
     let rows=(db[table]||[]).filter(row=>visibility(table,row));
     for(const [op,field,value] of filters) rows=rows.filter(row=>op==='eq'?row[field]===value:row[field]!==value);
     if(afterRead)afterRead(table);
     return {data:rows.slice(0,n)};
    },
   };}
  };
}
test('comprueba un token autenticado y seis tablas sin revelar datos de otras cuentas',async()=>{
  for(const actor of [A,B]){
    const client=stub({actor});
    const r=await runDemoAccountSelfcheck({supabase:client,userId:actor});
    assert.equal(r.status,'pass');assert.equal(r.checkedTables,6);
    assert.equal(r.authVerified,true);assert.equal(client.calls[0],'auth');
  }
});
test('no confunde una consulta de registro propio con prueba de RLS',async()=>{
  for(const leakTable of ['mwd_wallets','mwd_profiles','mwd_admin_roles','mwd_merchants','mwd_payment_requests','mwd_operations']){
    const client=stub({actor:A,leakTable});
    await assert.rejects(runDemoAccountSelfcheck({supabase:client,userId:A}),
      /Acceso ajeno|operación de otra cuenta/);
  }
});
test('un usuario verificado distinto bloquea todas las consultas SQL',async()=>{
  const client=stub({actor:B});
  await assert.rejects(runDemoAccountSelfcheck({supabase:client,userId:A}),/identidad/);
  assert.deepEqual(client.calls,['auth']);
});
test('sin un perfil propio o con errores de red nunca comunica éxito',async()=>{
  await assert.rejects(runDemoAccountSelfcheck({supabase:stub({missingProfile:true}),userId:A}),/registro propio/);
  await assert.rejects(runDemoAccountSelfcheck({supabase:stub({failedTable:'mwd_wallets'}),userId:A}),/No se pudo/);
});
test('al cerrar sesión durante la consulta, rechaza resultado obsoleto',async()=>{
  let current=true;
  const client=stub({afterRead:()=>{current=false;}});
  await assert.rejects(runDemoAccountSelfcheck({supabase:client,userId:A,isCurrent:()=>current}),/cambió/);
});
test('rechaza identificador no válido antes de consultar Supabase',async()=>{
  const client=stub();
  await assert.rejects(runDemoAccountSelfcheck({supabase:client,userId:'not-a-user'}),/inválida/);
  assert.equal(client.calls.length,0);
});
