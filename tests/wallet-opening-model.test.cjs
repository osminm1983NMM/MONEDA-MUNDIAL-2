'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
function ledger() {
 const wallets=new Map(), openings=new Map(), movements=[];
 return {
  wallets,openings,movements,
  provision(id,opening,source='new_wallet') {
   if(!Number.isSafeInteger(opening)||opening<0) throw Error('invalid_opening');
   if(wallets.has(id)) {if(openings.get(id)?.amount!==opening) throw Error('conflicting_provision'); return 'already_exists';}
   wallets.set(id,opening); openings.set(id,{amount:opening,source}); return 'created';
  },
  transfer(a,b,amount) {
   if(a===b||!Number.isSafeInteger(amount)||amount<=0) throw Error('invalid_transfer');
   if(!wallets.has(a)||!wallets.has(b)) throw Error('missing_wallet');
   if(wallets.get(a)<amount) throw Error('insufficient_funds');
   wallets.set(a,wallets.get(a)-amount);wallets.set(b,wallets.get(b)+amount);
   movements.push({source:a,destination:b,amount});
  },
  reconcile() {
   return [...wallets].every(([id,balance])=>{
    const expected=openings.get(id).amount+movements.reduce((net,m)=>net+(m.destination===id?m.amount:0)-(m.source===id?m.amount:0),0);
    return balance===expected;
   });
  }
 };
}
test('cada billetera tiene un asiento inicial y saldo conciliado',()=>{const m=ledger();m.provision('a',1000);m.provision('b',1000);m.transfer('a','b',125);assert.equal(m.reconcile(),true);assert.equal(m.openings.size,2);});
test('reintento de provision no duplica apertura',()=>{const m=ledger();assert.equal(m.provision('a',1000),'created');assert.equal(m.provision('a',1000),'already_exists');assert.equal(m.openings.size,1);assert.equal(m.wallets.get('a'),1000);});
test('provision conflictiva se rechaza',()=>{const m=ledger();m.provision('a',1000);assert.throws(()=>m.provision('a',2000),/conflicting_provision/);});
test('apertura negativa o no entera se rechaza',()=>{const m=ledger();for(const amount of [-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>m.provision('a',amount),/invalid_opening/);});
test('transferencias conservan saldo total',()=>{const m=ledger();m.provision('a',1000);m.provision('b',1000);m.transfer('a','b',300);assert.equal([...m.wallets.values()].reduce((a,b)=>a+b,0),2000);assert.equal(m.reconcile(),true);});
test('alteracion no registrada de saldo se detecta',()=>{const m=ledger();m.provision('a',1000);m.wallets.set('a',900);assert.equal(m.reconcile(),false);});
test('reconstruccion historica queda identificada como inferida',()=>{const m=ledger();m.provision('legacy',1000,'legacy_reconstruction');assert.equal(m.openings.get('legacy').source,'legacy_reconstruction');});
