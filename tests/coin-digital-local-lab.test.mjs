import test from 'node:test';
import assert from 'node:assert/strict';
import {
 initialLocalLab,quoteLocalLab,applyLocalLabConversion,viewLocalLab,
 readLocalLab,saveLocalLabConversion,localLabStorageKey
} from '../src/digital-money/coin-digital-local-lab.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const id='lab_request_20261029_01';
const at='2026-10-29T16:30:00.000Z';
const first={direction:'coin_to_digital',amount:'10',coinUsd:'0.25',digitalUsd:'1'};
const reverse={direction:'digital_to_coin',amount:'2.5',coinUsd:'0.25',digitalUsd:'1'};

test('cada cuenta tiene fichas separadas del saldo MWD y un identificador de almacenamiento distinto',()=>{
 const a=initialLocalLab(A),b=initialLocalLab(B);
 assert.equal(viewLocalLab(a,A).balances.coin,'100');
 assert.equal(viewLocalLab(a,A).balances.digital,'100');
 assert.notEqual(localLabStorageKey(A),localLabStorageKey(B));
 assert.throws(()=>viewLocalLab(a,B),/otra cuenta/);
 assert.deepEqual(Object.keys(a.balances).sort(),['coinMicro','digitalMicro']);
 assert.deepEqual(viewLocalLab(b,B).history,[]);
});

test('10 Coin a 0.25 corresponden a 2.5 Digital ficticias y quedan registradas',()=>{
 const quote=quoteLocalLab(first);
 assert.equal(quote.fromAmount,'10');
 assert.equal(quote.toAmount,'2.5');
 assert.equal(quote.realAsset,false);
 const result=applyLocalLabConversion(initialLocalLab(A),A,first,id,at);
 const v=viewLocalLab(result.state,A);
 assert.equal(result.duplicate,false);
 assert.equal(v.balances.coin,'90');
 assert.equal(v.balances.digital,'102.5');
 assert.equal(v.history.length,1);
 assert.deepEqual([v.history[0].fromAsset,v.history[0].toAsset],['coin','digital']);
 assert.equal(v.history[0].at,at);
});

test('la conversión inversa resta Digital y devuelve Coin sin errores decimales',()=>{
 const forward=applyLocalLabConversion(initialLocalLab(A),A,first,id,at).state;
 const back=applyLocalLabConversion(forward,A,reverse,'lab_request_20261029_02',at).state;
 assert.equal(viewLocalLab(back,A).balances.coin,'100');
 assert.equal(viewLocalLab(back,A).balances.digital,'100');
 assert.equal(back.history.length,2);
});

test('idempotencia: repetir el mismo identificador no duplica el movimiento',()=>{
 const firstResult=applyLocalLabConversion(initialLocalLab(A),A,first,id,at);
 const retry=applyLocalLabConversion(firstResult.state,A,first,id,at);
 assert.equal(retry.duplicate,true);
 assert.deepEqual(retry.state,firstResult.state);
});

test('cantidades inválidas o superiores al saldo se rechazan sin mutación',()=>{
 const start=initialLocalLab(A);
 assert.equal(quoteLocalLab({...first,amount:'-1'}),null);
 assert.equal(quoteLocalLab({...first,coinUsd:'0'}),null);
 assert.equal(quoteLocalLab({...first,amount:'0.0000001'}),null);
 assert.throws(()=>applyLocalLabConversion(start,A,{...first,amount:'101'},id,at),/insuficiente/);
 assert.equal(viewLocalLab(start,A).balances.coin,'100');
 assert.equal(start.history.length,0);
});

test('almacenamiento no comparte operaciones de A y B y sobrevive a una segunda lectura',async()=>{
 const map=new Map();
 const storage={getItem:async key=>map.get(key)??null,setItem:async(key,value)=>{map.set(key,value);}};
 const stored=await saveLocalLabConversion(storage,A,first,id,at);
 assert.equal(viewLocalLab(stored.state,A).balances.coin,'90');
 assert.equal(viewLocalLab(await readLocalLab(storage,A),A).history.length,1);
 assert.equal(viewLocalLab(await readLocalLab(storage,B),B).history.length,0);
 const repeat=await saveLocalLabConversion(storage,A,first,id,at);
 assert.equal(repeat.duplicate,true);
 assert.equal(viewLocalLab(repeat.state,A).balances.coin,'90');
});

test('fallo al guardar conserva el registro anterior y no presenta éxito',async()=>{
 const storage={getItem:async()=>null,setItem:async()=>{throw Error('sin espacio');}};
 await assert.rejects(saveLocalLabConversion(storage,A,first,id,at),/sin espacio/);
 assert.equal(viewLocalLab(await readLocalLab(storage,A),A).balances.digital,'100');
});

test('un registro corrupto no se reinicia silenciosamente',async()=>{
 const storage={getItem:async()=>'{mal-json'};
 await assert.rejects(readLocalLab(storage,A),/ilegible/);
});
