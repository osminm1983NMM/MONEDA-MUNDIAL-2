import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReusePendingDemoOperation,demoOperationStillBelongsToUser,claimDemoOperationLock,retainPendingDemoRequest,canConfirmDemoOperation} from '../src/demo-operation-session.mjs';

const session=(id)=>({getSession:async()=>({data:{session:id?{user:{id}}:null},error:null})});
test('misma cuenta e importe reutiliza UUID ficticio para reintentos',()=>{
 const op={userId:'A',type:'transfer',cents:100,code:'MWD-ABC',id:'uuid-original'};
 assert.equal(canReusePendingDemoOperation(op,{userId:'A',type:'transfer',cents:100,code:'MWD-ABC'}),true);
});
test('nunca reutiliza UUID pendiente de otra cuenta o de datos modificados',()=>{
 const op={userId:'A',type:'transfer',cents:100,code:'MWD-ABC',id:'uuid-original'};
 for(const change of [{userId:'B'},{cents:101},{code:'MWD-DEF'},{type:'contribution'}]){
  assert.equal(canReusePendingDemoOperation(op,{...op,...change}),false);
 }
 assert.equal(canReusePendingDemoOperation(op,{...op,userId:''}),false);
 assert.equal(canReusePendingDemoOperation(null,op),false);
});
test('una respuesta de A solo se aplica mientras A siga conectado',async()=>{
 assert.equal(await demoOperationStillBelongsToUser(session('A'),'A'),true);
 assert.equal(await demoOperationStillBelongsToUser(session('B'),'A'),false);
 assert.equal(await demoOperationStillBelongsToUser(session(null),'A'),false);
 assert.equal(await demoOperationStillBelongsToUser(session('A'),''),false);
});
test('si no se puede verificar la sesión, no confirmar una transferencia ficticia',async()=>{
 assert.equal(await demoOperationStillBelongsToUser({getSession:async()=>({data:{session:{user:{id:'A'}}},error:{message:'err'}})},'A'),false);
 assert.equal(await demoOperationStillBelongsToUser({getSession:async()=>{throw Error('red')}} ,'A'),false);
});

test('doble pulsación concurrente solo obtiene un bloqueo antes de esperar sesión',()=>{
 const busy={current:false};
 assert.equal(claimDemoOperationLock(busy),true);
 assert.equal(claimDemoOperationLock(busy),false);
 busy.current=false;
 assert.equal(claimDemoOperationLock(busy),true);
});
test('bloqueo falla cerrado si no existe referencia válida',()=>{
 assert.equal(claimDemoOperationLock(null),false);
 assert.equal(claimDemoOperationLock({current:true}),false);
});

test('respuesta incierta conserva identificador de reintento solo en misma sesión',()=>{
 assert.equal(retainPendingDemoRequest(8,8),true);
 assert.equal(retainPendingDemoRequest(8,9),false);
 assert.equal(retainPendingDemoRequest(8,7),false);
 assert.equal(retainPendingDemoRequest(undefined,undefined),false);
});

test('no confirma después de cerrar y entrar a la misma cuenta durante la comprobación asíncrona',async()=>{
 const epoch={current:3};
 const auth={getSession:async()=>{epoch.current=4;return {data:{session:{user:{id:'A'}}},error:null};}};
 assert.equal(await canConfirmDemoOperation(auth,'A',epoch,3),false);
});
test('confirma únicamente cuando sesión, usuario y generación coinciden',async()=>{
 const epoch={current:3};
 assert.equal(await canConfirmDemoOperation(session('A'),'A',epoch,3),true);
 assert.equal(await canConfirmDemoOperation(session('B'),'A',epoch,3),false);
 assert.equal(await canConfirmDemoOperation(session('A'),'A',epoch,2),false);
});
