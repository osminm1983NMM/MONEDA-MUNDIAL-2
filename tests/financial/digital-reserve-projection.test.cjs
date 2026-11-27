'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {projectDigitalReserve:project}=require('../../financial-sandbox/digital-reserve-projection.cjs');
const fund=(amountMinor='1000',eventId='f')=>({eventId,kind:'reserve_confirmed',amountMinor,asset:'USD',purpose:'digital_reserve'});
const issue=(amountMinor='1000',owner='alice',eventId='i')=>({eventId,kind:'issue_confirmed',amountMinor,owner});
const hold=(amountMinor='400',owner='alice',eventId='h',redemptionId='r')=>({eventId,kind:'redemption_reserved',amountMinor,owner,redemptionId});
const event=(kind,eventId,redemptionId='r')=>({kind,eventId,redemptionId});
const run=(...events)=>project({environment:'sandbox',events});
test('Digital liabilities remain covered through reserve, burn and payout; each journal balances separately',()=>{
 const base=[fund(),issue(),hold()];
 const reserved=run(...base);a.equal(reserved.outstandingDigitalMinor,'1000');a.deepEqual(reserved.accounts,[{owner:'alice',available:'600',reserved:'400'}]);
 const burned=run(...base,event('burn_confirmed','b'));a.equal(burned.outstandingDigitalMinor,'600');a.equal(burned.redemptionPayableUsdMinor,'400');a.equal(burned.obligationsUsdMinor,'1000');a.equal(burned.reserveUsdMinor,'1000');
 const paid=run(...base,event('burn_confirmed','b'),event('payout_confirmed','p'));
 a.equal(paid.reserveUsdMinor,'600');a.equal(paid.obligationsUsdMinor,'600');a.equal(paid.redemptionPayableUsdMinor,'0');a.equal(paid.coverageSufficient,true);
 for(const j of paid.journal)a.equal(j.entries.reduce((s,x)=>s+BigInt(x.signedMinor),0n),0n);
});
test('Coin, remittance balances and wrong currency cannot fund Digital reserves',()=>{
 for(const patch of [{asset:'COIN'},{asset:'HNL'},{purpose:'remittance_customer'},{purpose:'operating_cash'}])a.throws(()=>run({...fund(),...patch}),/INELIGIBLE_RESERVE/);
 a.throws(()=>run(issue()),/INSUFFICIENT_COVERAGE/);
});
test('pending payout continues to consume reserve coverage; loss blocks additional issuance',()=>{
 const events=[fund(),issue(),hold(),event('burn_confirmed','b')];
 a.throws(()=>run(...events,issue('1','bob','i2')),/INSUFFICIENT_COVERAGE/);
 const loss={eventId:'loss',kind:'reserve_loss',amountMinor:'100'};
 const x=run(...events,loss);a.equal(x.coverageSufficient,false);a.equal(x.shortfallUsdMinor,'100');
 a.throws(()=>run(...events,loss,issue('1','bob','i2')),/INSUFFICIENT_COVERAGE/);
 const restored=run(...events,loss,fund('101','f2'),issue('1','bob','i2'));a.equal(restored.coverageSufficient,true);
});
test('reservation prevents double spending; only unburned reservation can be cancelled',()=>{
 a.throws(()=>run(fund(),issue(),hold('700'),hold('400','alice','h2','r2')),/INSUFFICIENT_AVAILABLE/);
 a.throws(()=>run(fund(),issue(),hold('1','bob')),/INSUFFICIENT_AVAILABLE/);
 const x=run(fund(),issue(),hold(),event('redemption_cancelled','c'));a.equal(x.accounts[0].available,'1000');a.equal(x.accounts[0].reserved,'0');
 a.throws(()=>run(fund(),issue(),hold(),event('burn_confirmed','b'),event('redemption_cancelled','c')),/INVALID_TRANSITION/);
 a.throws(()=>run(fund(),issue(),hold(),event('payout_confirmed','p')),/INVALID_TRANSITION/);
});
test('event replays do not repeat financial effects; conflicting IDs and second payouts fail',()=>{
 const events=[fund(),issue(),hold(),event('burn_confirmed','b'),event('payout_confirmed','p')];
 a.deepEqual(run(...events,...events),run(...events));
 a.throws(()=>run(...events,issue('1')),/EVENT_ID_CONFLICT/);
 a.throws(()=>run(...events,event('payout_confirmed','p2')),/INVALID_TRANSITION/);
 a.throws(()=>run(...events,hold('1','alice','h2')),/REDEMPTION_ID_CONFLICT/);
});
test('amounts are exact above JS safe integer and malformed data/production rejected',()=>{
 const x=run(fund('9007199254740993'),issue('9007199254740993'));a.equal(x.obligationsUsdMinor,'9007199254740993');
 for(const v of [0,1,'0','01','1.1','-1','1e3','1000000000000000000'])a.throws(()=>run(fund(v)),/INVALID_AMOUNT/);
 a.throws(()=>run({...fund(),extra:true}),/INVALID_EVENT/);
 a.throws(()=>project({environment:'production',events:[]}),/SANDBOX_ONLY/);
});

test('non-string event kinds cannot turn cancellation into a payout or alter the journal',()=>{
 const base=[fund(),issue(),hold(),event('burn_confirmed','b')];
 for(const kind of [['payout_confirmed'],['redemption_cancelled'],['burn_confirmed'],null,1,{toString:()=> 'payout_confirmed'}]){
  a.throws(()=>run(...base,event(kind,'bad')),/INVALID_EVENT/);
 }
 a.equal(run(...base).redemptionPayableUsdMinor,'400');
 a.equal(run(...base).reserveUsdMinor,'1000');
});
