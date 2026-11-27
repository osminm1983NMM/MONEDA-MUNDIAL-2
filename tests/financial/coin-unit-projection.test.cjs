'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {projectCoinUnits:project}=require('../../financial-sandbox/coin-unit-projection.cjs');
const {projectDigitalReserve:digital}=require('../../financial-sandbox/digital-reserve-projection.cjs');
const mint=(amountMinor='1000',eventId='m')=>({eventId,kind:'mint_confirmed',amountMinor});
const hold=(from='treasury',to='alice',amountMinor='300',eventId='h',transferId='t')=>({eventId,kind:'transfer_reserved',from,to,amountMinor,transferId});
const transition=(kind,eventId,transferId='t')=>({eventId,kind,transferId});
const burn=(owner='alice',amountMinor='100',eventId='b')=>({eventId,kind:'burn_confirmed',owner,amountMinor});
const run=(...events)=>project({environment:'sandbox',capMinor:'1000',events});
test('treasury distribution remains reserved until confirmation and supply is conserved',()=>{
 const x=run(mint(),hold());a.equal(x.treasuryMinor,'1000');a.equal(x.nonTreasuryMinor,'0');
 a.deepEqual(x.accounts,[{owner:'treasury',available:'700',reserved:'300'}]);
 const y=run(mint(),hold(),transition('transfer_confirmed','c'));
 a.equal(y.treasuryMinor,'700');a.equal(y.nonTreasuryMinor,'300');a.equal(y.outstandingMinor,'1000');
 a.deepEqual(y.accounts,[{owner:'treasury',available:'700',reserved:'0'},{owner:'alice',available:'300',reserved:'0'}]);
 for(const j of y.journal){a.equal(j.asset,'COIN_TEST');a.equal(j.entries.reduce((s,v)=>s+BigInt(v.signedMinor),0n),0n);}
});
test('burn reduces outstanding units but does not replenish lifetime test cap',()=>{
 const events=[mint(),hold(),transition('transfer_confirmed','c'),burn()];
 const x=run(...events);a.equal(x.mintedMinor,'1000');a.equal(x.burnedMinor,'100');a.equal(x.outstandingMinor,'900');a.equal(x.remainingIssuanceMinor,'0');
 a.throws(()=>run(...events,mint('1','m2')),/FIXTURE_CAP_EXCEEDED/);
 a.throws(()=>run(mint('1001')),/FIXTURE_CAP_EXCEEDED/);
});
test('reserved units cannot be spent or burned; cancellation releases exactly once',()=>{
 a.throws(()=>run(mint(),hold(),hold('treasury','bob','701','h2','t2')),/INSUFFICIENT_AVAILABLE/);
 a.throws(()=>run(mint(),hold(),burn('treasury','701')),/INSUFFICIENT_AVAILABLE/);
 a.throws(()=>run(mint(),hold(),hold('alice','bob','1','h2','t2')),/INSUFFICIENT_AVAILABLE/);
 const events=[mint(),hold(),transition('transfer_cancelled','x')];
 a.equal(run(...events).accounts[0].available,'1000');
 a.throws(()=>run(...events,transition('transfer_confirmed','c')),/INVALID_TRANSITION/);
 a.throws(()=>run(mint(),hold('treasury','treasury')),/SAME_ACCOUNT/);
});
test('replay is idempotent; conflicting event and transfer identities fail closed',()=>{
 const events=[mint(),hold(),transition('transfer_confirmed','c'),burn()];
 a.deepEqual(run(...events,...events),run(...events));
 a.throws(()=>run(...events,mint('1')),/EVENT_ID_CONFLICT/);
 a.throws(()=>run(...events,hold('treasury','bob','1','h2')),/TRANSFER_ID_CONFLICT/);
 a.throws(()=>run(...events,transition('transfer_confirmed','c2')),/INVALID_TRANSITION/);
});
test('Coin journal does not accept Digital issuance or substitute Coin for reserves',()=>{
 a.throws(()=>run({eventId:'f',kind:'reserve_confirmed',amountMinor:'1000',asset:'USD',purpose:'digital_reserve'}),/INVALID_EVENT/);
 a.throws(()=>digital({environment:'sandbox',events:[{eventId:'f',kind:'reserve_confirmed',amountMinor:'1000',asset:'COIN_TEST',purpose:'digital_reserve'}]}),/INELIGIBLE_RESERVE/);
});
test('exact integer unit quantities, explicit fixture cap and environment guard',()=>{
 const amount='9007199254740993';const x=project({environment:'sandbox',capMinor:amount,events:[mint(amount)]});
 a.equal(x.outstandingMinor,amount);
 for(const v of [0,1,'0','01','1.5','-1','1e3'])a.throws(()=>run(mint(v)),/INVALID_AMOUNT/);
 a.throws(()=>project({environment:'sandbox',events:[]}),/INVALID_FIXTURE_CAP/);
 a.throws(()=>project({environment:'production',capMinor:'1000',events:[]}),/SANDBOX_ONLY/);
});

test('non-string cancellation or confirmation cannot release or transfer reserved Coin',()=>{
 const base=[mint(),hold()];
 for(const kind of [['transfer_cancelled'],['transfer_confirmed'],null,1,{toString:()=> 'transfer_confirmed'}]){
  a.throws(()=>run(...base,transition(kind,'bad')),/INVALID_EVENT/);
 }
 a.equal(run(...base).transfers[0].state,'reserved');
 a.equal(run(...base).nonTreasuryMinor,'0');
});
