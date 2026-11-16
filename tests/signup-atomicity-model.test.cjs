'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
function store(){const profiles=new Map(),wallets=new Map(),openings=new Map();return {profiles,wallets,openings,signup(id,{failAt=null}={}){if(profiles.has(id)||wallets.has(id)||openings.has(id))throw Error('duplicate_user');const staged=[];try{profiles.set(id,'Usuario MWD');staged.push(()=>profiles.delete(id));if(failAt==='profile')throw Error('profile_failure');wallets.set(id,1000000);staged.push(()=>wallets.delete(id));if(failAt==='wallet')throw Error('wallet_failure');openings.set(id,1000000);staged.push(()=>openings.delete(id));if(failAt==='opening')throw Error('opening_failure');return true;}catch(e){for(const undo of staged.reverse())undo();throw e;}}};}
test('registro correcto crea perfil, billetera y apertura',()=>{const s=store();s.signup('a');assert.equal(s.profiles.size,1);assert.equal(s.wallets.get('a'),1000000);assert.equal(s.openings.get('a'),1000000);});
test('fallo tras perfil revierte todos los registros',()=>{const s=store();assert.throws(()=>s.signup('a',{failAt:'profile'}));assert.deepEqual([s.profiles.size,s.wallets.size,s.openings.size],[0,0,0]);});
test('fallo tras billetera revierte perfil y billetera',()=>{const s=store();assert.throws(()=>s.signup('a',{failAt:'wallet'}));assert.deepEqual([s.profiles.size,s.wallets.size,s.openings.size],[0,0,0]);});
test('fallo de apertura revierte el registro completo',()=>{const s=store();assert.throws(()=>s.signup('a',{failAt:'opening'}));assert.deepEqual([s.profiles.size,s.wallets.size,s.openings.size],[0,0,0]);});
test('registro duplicado no altera saldos ni asientos',()=>{const s=store();s.signup('a');assert.throws(()=>s.signup('a'),/duplicate_user/);assert.deepEqual([s.profiles.size,s.wallets.size,s.openings.size],[1,1,1]);});
// Modelo JS: no sustituye pruebas de atomicidad PostgreSQL/Auth.
