import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDemoConfirmationPreflight} from '../src/digital-money/demo-confirmation-preflight.mjs';
const now=Date.parse('2026-10-22T18:00:00Z');
const quote={quoteId:'11111111-1111-4111-8111-111111111111',fromAsset:'COIN',toAsset:'STABLE',
 amountInMicro:1000000,expiresAt:'2026-10-22T18:01:00Z'};
const row={id:'22222222-2222-4222-8222-222222222222',fromAsset:'COIN',toAsset:'STABLE',
 amountInMicro:1000000,amountOutMicro:124687,feeOutMicro:313,
 priceSnapshot:'0.125',settledAt:'2026-10-22T17:59:00Z'};
const payload=(history=[])=>({mode:'sandbox_only',realPaymentsEnabled:false,
 marketRateConnected:false,stableBackedByReserves:false,coinMicro:97000000,
 stableMicro:1000374061,history});
const check=(data,extra={})=>inspectDemoConfirmationPreflight({quote,
 rpc:async()=>({data}),now:()=>now,...extra});
test('consulta saldo actualizado y avisa operación idéntica reciente',async()=>{
 const r=await check(payload([row]));
 assert.equal(r.repeated,true);assert.equal(r.balances.coinMicro,97000000);
 assert.equal(r.realPaymentsEnabled,false);
});
test('no advierte si no hay conversiones previas',async()=>{
 assert.equal((await check(payload())).repeated,false);
});
test('nunca permite confirmar si saldo es insuficiente',async()=>{
 await assert.rejects(check({...payload(),coinMicro:999999}),/insuficiente/);
});
test('bloquea historial incompleto de veinte registros',async()=>{
 const list=Array.from({length:20},(_,i)=>({...row,
 id:'22222222-2222-4222-8222-'+String(i).padStart(12,'0')}));
 await assert.rejects(check(payload(list)),/Historial incompleto/);
});
test('sesión obsoleta o cotización vencida detienen preflight',async()=>{
 await assert.rejects(check(payload(),{isCurrent:()=>false}),/cambió/);
 await assert.rejects(check(payload(),{now:()=>now+100000}),/venció/);
});
test('sin servidor o con respuesta inválida se bloquea',async()=>{
 await assert.rejects(check(null),/No se pudo|no verificable/);
 await assert.rejects(check(payload(),{rpc:async()=>({error:{message:'offline'}})}),/No se pudo/);
});
