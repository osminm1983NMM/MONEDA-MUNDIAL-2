// Modelo determinista de DOS cuentas ficticias. No toca Supabase ni mueve MWD reales.
// IMPORTANTE: contrasta reglas esperadas; NO ejecuta las RPC PostgreSQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function createIsolatedLedger() {
  const balances = new Map([['A',1_000_000],['B',1_000_000]]);
  const operations = new Map();
  const payments = new Map([
    ['payment-1',{merchant:'A',amount:200,status:'pending'}],
    ['payment-2',{merchant:'A',amount:300,status:'pending'}],
  ]);
  const key=(actor,request)=>actor+'|'+request;
  const snapshot=()=>({
    A:balances.get('A'),B:balances.get('B'),
    operations:operations.size,
    paid:[...payments].filter(([,p])=>p.status==='paid').length,
  });

  function transfer(actor,destination,amount,request) {
    if(!balances.has(actor)||!balances.has(destination)) throw Error('wallet not found');
    if(actor===destination) throw Error('cannot pay yourself');
    if(!Number.isSafeInteger(amount)||amount<1||amount>100_000_000) throw Error('invalid amount');
    if(!request) throw Error('invalid request');
    const previous=operations.get(key(actor,request));
    if(previous){
      if(previous.kind!=='transfer'||previous.destination!==destination||previous.amount!==amount)
        throw Error('request id previously used');
      return 'already_processed';
    }
    if(balances.get(actor)<amount) throw Error('insufficient funds');
    balances.set(actor,balances.get(actor)-amount);
    balances.set(destination,balances.get(destination)+amount);
    operations.set(key(actor,request),{kind:'transfer',destination,amount});
    return 'ok';
  }

  function contribute(actor,amount,request) {
    if(!balances.has(actor)||!Number.isSafeInteger(amount)||amount<1||!request)
      throw Error('invalid contribution');
    const previous=operations.get(key(actor,request));
    if(previous){
      if(previous.kind!=='contribution'||previous.amount!==amount) throw Error('request id previously used');
      return 'already_processed';
    }
    if(balances.get(actor)<amount) throw Error('insufficient funds');
    balances.set(actor,balances.get(actor)-amount);
    operations.set(key(actor,request),{kind:'contribution',amount});
    return 'ok';
  }

  function pay(user,id){
    const p=payments.get(id);
    if(!p) throw Error('not found');
    if(user===p.merchant) throw Error('cannot pay self');
    if(p.status==='paid'){
      if(operations.has(key(user,id))) return 'already_processed';
      throw Error('already paid');
    }
    if(p.status!=='pending') throw Error('not payable');
    const result=transfer(user,p.merchant,p.amount,id);
    p.status='paid';
    return result;
  }

  function cancel(user,id){
    const p=payments.get(id);
    if(!p||p.merchant!==user) throw Error('not owner');
    if(p.status==='paid') throw Error('paid');
    if(p.status==='pending')p.status='cancelled';
    return p.status;
  }

  function viewWallet(requester,target){
    if(requester!==target)throw Error('RLS denied');
    return balances.get(target);
  }
  function ownerSummary(requester){
    if(requester!=='A')throw Error('not owner');
    return snapshot();
  }
  return {transfer,contribute,pay,cancel,viewWallet,ownerSummary,snapshot,payments};
}

test('A envía 1 MWD ficticio a B una sola vez y se conservan los saldos',()=>{
  const l=createIsolatedLedger();
  assert.equal(l.transfer('A','B',100,'transfer-1'),'ok');
  assert.equal(l.snapshot().A,999_900);
  assert.equal(l.snapshot().B,1_000_100);
  assert.equal(l.transfer('A','B',100,'transfer-1'),'already_processed');
  assert.equal(l.snapshot().operations,1);
  assert.equal(l.snapshot().A+l.snapshot().B,2_000_000);
});

test('idempotencia: rechazar reutilización de UUID con importe diferente',()=>{
  const l=createIsolatedLedger();
  assert.equal(l.transfer('A','B',100,'transfer-1'),'ok');
  assert.throws(()=>l.transfer('A','B',101,'transfer-1'),/previously used/);
  assert.equal(l.snapshot().operations,1);
});

test('no autotransferencias, sobregiros ni cantidades negativas',()=>{
  const l=createIsolatedLedger();
  assert.throws(()=>l.transfer('A','A',100,'self'),/cannot pay yourself/);
  assert.throws(()=>l.transfer('A','B',1_000_001,'overdraft'),/insufficient funds/);
  assert.throws(()=>l.transfer('A','B',-1,'negative'),/invalid amount/);
  assert.equal(l.snapshot().operations,0);
});

test('B paga 2 MWD al comercio de A una sola vez; segundo cobro cancelado nunca se paga',()=>{
  const l=createIsolatedLedger();
  assert.equal(l.pay('B','payment-1'),'ok');
  assert.equal(l.pay('B','payment-1'),'already_processed');
  assert.throws(()=>l.cancel('A','payment-1'),/paid/);
  assert.throws(()=>l.cancel('B','payment-2'),/not owner/);
  assert.equal(l.cancel('A','payment-2'),'cancelled');
  assert.throws(()=>l.pay('B','payment-2'),/not payable/);
  assert.equal(l.snapshot().A,1_000_200);
  assert.equal(l.snapshot().B,999_800);
  assert.equal(l.snapshot().operations,1);
});

test('A aporta 0.50 MWD ficticio una sola vez',()=>{
  const l=createIsolatedLedger();
  assert.equal(l.contribute('A',50,'contribution-1'),'ok');
  assert.equal(l.contribute('A',50,'contribution-1'),'already_processed');
  assert.equal(l.snapshot().A,999_950);
  assert.equal(l.snapshot().operations,1);
});

test('privacidad de dos cuentas y panel de propietario',()=>{
  const l=createIsolatedLedger();
  assert.equal(l.viewWallet('A','A'),1_000_000);
  assert.equal(l.viewWallet('B','B'),1_000_000);
  assert.throws(()=>l.viewWallet('B','A'),/RLS denied/);
  assert.throws(()=>l.ownerSummary('B'),/not owner/);
  assert.equal(l.ownerSummary('A').A,1_000_000);
});
