import test from 'node:test';import assert from 'node:assert/strict';
import {createTwoAccountDemoVerification} from '../src/digital-money/demo-two-account-verification.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const ca='33333333-3333-4333-8333-333333333333',cb='44444444-4444-4444-8444-444444444444';
const op=(id,fromAsset,amountInMicro,amountOutMicro)=>({id,fromAsset,amountInMicro,amountOutMicro});
function snapshots(){return [
 {userId:A,coinMicro:100000000,stableMicro:1000000000,history:[]},
 {userId:A,coinMicro:99000000,stableMicro:1000120000,history:[op(ca,'COIN',1000000,120000)]},
 {userId:B,coinMicro:100000000,stableMicro:1000000000,history:[]},
 {userId:B,coinMicro:107000000,stableMicro:999000000,history:[op(cb,'STABLE',1000000,7000000)]},
 {userId:A,coinMicro:99000000,stableMicro:1000120000,history:[op(ca,'COIN',1000000,120000)]}
];}
const args={isCurrent:()=>true};
test('A -> B -> A aislados: dos conversiones opuestas nuevas y saldos consistentes',async()=>{
 const queue=snapshots();const runner=createTwoAccountDemoVerification({inspect:async()=>queue.shift()});
 for(const [fn,state] of [['prepareA','a_before'],['finishA','a_after'],['prepareB','b_before'],['finishB','b_after'],['verifyA','pass']]){
  assert.equal((await runner[fn](args)).stage,state);
 }
 assert.equal(queue.length,0);runner.reset();assert.equal(runner.getStage(),'start');
});
test('el mismo usuario no puede actuar como A y B',async()=>{
 const q=snapshots();q[2].userId=A;const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await run.finishA(args);
 await assert.rejects(run.prepareB(args),/DISTINTA/);
 assert.equal(run.getStage(),'a_after');
});
test('historial de A visible en B bloquea la verificacion',async()=>{
 const q=snapshots();q[2].history=[op(ca,'COIN',1000000,120000)];
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await run.finishA(args);
 await assert.rejects(run.prepareB(args),/otra cuenta/);
});
test('sin conversión nueva no se puede avanzar ni marcar aprobado',async()=>{
 const q=snapshots();q[1]=q[0];
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await assert.rejects(run.finishA(args),/exactamente una/);
 assert.equal(run.getStage(),'a_before');
});
test('saldos sin conciliacion detienen el flujo',async()=>{
 const q=snapshots();q[1].coinMicro=99999999;
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await assert.rejects(run.finishA(args),/saldos/);
});
test('si el saldo de A cambia mientras usa B se detiene la prueba',async()=>{
 const q=snapshots();q[4].stableMicro+=1;
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await run.finishA(args);await run.prepareB(args);await run.finishB(args);
 await assert.rejects(run.verifyA(args),/saldo de A cambió/);
});
test('cambio de sesión invalida prueba y nunca escribe resultado PASS',async()=>{
 const run=createTwoAccountDemoVerification({inspect:async()=>snapshots()[0]});
 await assert.rejects(run.prepareA({isCurrent:()=>false}),/sesión cambió/);
 assert.equal(run.getStage(),'start');
});
test('fuera de orden no ejecuta inspección',async()=>{
 let count=0;const run=createTwoAccountDemoVerification({inspect:async()=>{count++;}});
 await assert.rejects(run.finishB(args),/fuera de orden/);assert.equal(count,0);
});

test('bloquea filtración HISTÓRICA de A visible en B aunque la conversión nueva sea otra',async()=>{
 const q=snapshots();
 const oldA='55555555-5555-4555-8555-555555555555';
 q[0].history=[op(oldA,'COIN',2000000,240000)];
 q[1].history=[op(ca,'COIN',1000000,120000),op(oldA,'COIN',2000000,240000)];
 q[2].history=[op(oldA,'COIN',2000000,240000)];
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await run.finishA(args);
 await assert.rejects(run.prepareB(args),/otra cuenta/);
});
test('bloquea filtración HISTÓRICA de B visible en A al volver',async()=>{
 const q=snapshots();
 const oldB='66666666-6666-4666-8666-666666666666';
 q[2].history=[op(oldB,'STABLE',2000000,14000000)];
 q[3].history=[op(cb,'STABLE',1000000,7000000),op(oldB,'STABLE',2000000,14000000)];
 q[4].history.push(op(oldB,'STABLE',2000000,14000000));
 const run=createTwoAccountDemoVerification({inspect:async()=>q.shift()});
 await run.prepareA(args);await run.finishA(args);await run.prepareB(args);await run.finishB(args);
 await assert.rejects(run.verifyA(args),/otra cuenta/);
});

test('historial Coin/Digital de 20 entradas no puede aprobar prueba incompleta',async()=>{
 const history=Array.from({length:20},(_,i)=>op(
  '77777777-7777-4777-8777-'+String(i).padStart(12,'0'),'COIN',1000000,120000));
 const run=createTwoAccountDemoVerification({inspect:async()=>({
  userId:A,coinMicro:100000000,stableMicro:1000000000,history
 })});
 await assert.rejects(run.prepareA(args),/Historial incompleto/);
 assert.equal(run.getStage(),'start');
});
