'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {projectDigitalCoinSwaps:project}=require('../../financial-sandbox/digital-coin-swap-projection.cjs');
const digitalEvents=[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
];
const coinEvents=[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}];
const quote=(id='q',direction='digital_to_coin',at=10,patch={})=>({eventId:id+'-q',kind:'quote_created',at,quoteId:id,owner:'alice',direction,digitalMinor:'200',coinMinor:'300',expiresAt:at+100,...patch});
const accept=(id='q',at=11,owner='alice')=>({eventId:id+'-a',kind:'quote_accepted',at,quoteId:id,owner});
const finish=(id='q',at=12,kind='swap_confirmed')=>({eventId:id+'-end',kind,at,quoteId:id});
const run=(events,patch={})=>project({environment:'sandbox',capMinor:'1000',digitalEvents,coinEvents,events,...patch});
const bal=(x,owner)=>x.accounts.find(b=>b.owner===owner)||{available:'0',reserved:'0'};
test('forward and reverse swaps reserve both assets and conserve independent supplies',()=>{
 const hold=run([quote(),accept()]);
 a.equal(bal(hold.digital,'alice').reserved,'200');a.equal(bal(hold.coin,'treasury').reserved,'300');
 a.equal(bal(hold.coin,'alice').available,'0');
 const x=run([quote(),accept(),finish()]);
 a.equal(bal(x.digital,'alice').available,'800');a.equal(bal(x.coin,'alice').available,'300');
 a.equal(x.digital.reserveUsdMinor,'2000');a.equal(x.digital.obligationsUsdMinor,'2000');a.equal(x.coin.outstandingMinor,'1000');
 const y=run([quote(),accept(),finish(),quote('r','coin_to_digital',20),accept('r',21),finish('r',22)]);
 a.equal(bal(y.digital,'alice').available,'1000');a.equal(bal(y.coin,'alice').available,'0');
 for(const j of [...y.digital.journal,...y.coin.journal])a.equal(j.entries.reduce((s,e)=>s+BigInt(e.signedMinor),0n),0n);
});
test('insufficient inventory on either side rejects the entire projection',()=>{
 a.throws(()=>run([quote('q','digital_to_coin',10,{coinMinor:'1001'}),accept(),finish()]),/INSUFFICIENT_AVAILABLE/);
 a.throws(()=>run([quote('q','digital_to_coin',10,{digitalMinor:'1001'}),accept(),finish()]),/INSUFFICIENT_AVAILABLE/);
 a.throws(()=>run([quote('q','coin_to_digital'),accept()]),/INSUFFICIENT_AVAILABLE/);
 a.equal(bal(run([]).digital,'alice').available,'1000');a.equal(bal(run([]).coin,'treasury').available,'1000');
});
test('competing reservations and redemption holds cannot double spend',()=>{
 a.throws(()=>run([quote('q','digital_to_coin',10,{digitalMinor:'700'}),accept(),quote('r','digital_to_coin',20,{digitalMinor:'400'}),accept('r',21)]),/INSUFFICIENT_AVAILABLE/);
 const seed=[...digitalEvents,{eventId:'rh',kind:'redemption_reserved',owner:'alice',amountMinor:'900',redemptionId:'r'}];
 a.throws(()=>run([quote(),accept()],{digitalEvents:seed}),/INSUFFICIENT_AVAILABLE/);
});
test('expiry and ownership enforced on acceptance; already reserved quote can settle later',()=>{
 a.throws(()=>run([quote(),accept('q',110)]),/QUOTE_EXPIRED/);
 a.throws(()=>run([quote(),accept('q',11,'bob')]),/OWNER_MISMATCH/);
 a.throws(()=>run([quote('q','digital_to_coin',10,{expiresAt:300011})]),/INVALID_QUOTE/);
 a.throws(()=>run([quote(),accept('q',9)]),/NONMONOTONIC_TIME/);
 a.equal(run([quote(),accept(),finish('q',120)]).quotes[0].state,'confirmed');
});
test('cancel releases both sides, never reuses quote; replay cannot change amounts or settle twice',()=>{
 const es=[quote(),accept(),finish('q',12,'swap_cancelled')],x=run(es);
 a.equal(bal(x.digital,'alice').available,'1000');a.equal(bal(x.coin,'treasury').available,'1000');
 a.deepEqual(run([...es,...es]),x);
 a.throws(()=>run([...es,{...accept(),eventId:'retry',at:13}]),/QUOTE_CONSUMED/);
 a.throws(()=>run([...es,{...finish(),eventId:'retry',at:13}]),/INVALID_SWAP_TRANSITION/);
 a.throws(()=>run([...es,quote('q','digital_to_coin',10,{digitalMinor:'201'})]),/EVENT_ID_CONFLICT/);
});
test('reserve deficit, invalid namespace, invalid units and production are rejected',()=>{
 const seed=[...digitalEvents,{eventId:'loss',kind:'reserve_loss',amountMinor:'1'}];
 a.throws(()=>run([quote(),accept()],{digitalEvents:seed}),/INSUFFICIENT_COVERAGE/);
 a.throws(()=>run([],{coinEvents:[{...coinEvents[0],eventId:'swap-q-hold'}]}),/RESERVED_NAMESPACE/);
 a.throws(()=>run([quote('q','digital_to_coin',10,{coinMinor:3})]),/INVALID_QUOTE/);
 a.throws(()=>run([quote('q','digital_to_coin',10,{owner:'treasury'})]),/INVALID_QUOTE/);
 a.throws(()=>run([],{environment:'production'}),/SANDBOX_ONLY/);
});
