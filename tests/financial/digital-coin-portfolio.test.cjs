'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const fs=require('node:fs');const {join}=require('node:path');const {tmpdir}=require('node:os');
const {openDigitalCoinLedger:open}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const {readDigitalCoinPortfolio:read}=require('../../financial-sandbox/digital-coin-portfolio.cjs');
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'900'},
 {eventId:'ib',kind:'issue_confirmed',owner:'bob',amountMinor:'100'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const quote=(owner,q,at)=>({eventId:q+'-q',kind:'quote_created',at,quoteId:q,owner,direction:'digital_to_coin',digitalMinor:'50',coinMinor:'75',expiresAt:at+100});
const accept=(owner,q,at)=>({eventId:q+'-a',kind:'quote_accepted',at,quoteId:q,owner});
const settle=(q,at,kind='swap_confirmed')=>({eventId:q+'-s',kind,at,quoteId:q});
function fixture(fn,base=seed){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-portfolio-'));
 const ledger=open({environment:'sandbox',path:join(dir,'ledger.sqlite'),initialize:true,seed:base});
 try{fn(ledger,actor=>read({environment:'sandbox',ledger,verifiedActor:actor}));}
 finally{ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('portfolio exposes only own balances and quotes from a single read-only cut',()=>fixture((ledger,own)=>{
 ledger.appendBatch([quote('alice','a',10),accept('alice','a',11),quote('bob','b',12),accept('bob','b',13),settle('b',14)]);
 const before=ledger.manifest(),v=own('alice'),w=own('bob');
 a.deepEqual(v.assets,[{asset:'DIGITAL_TEST',availableMinor:'850',reservedMinor:'50',totalMinor:'900'},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}]);
 a.equal(v.conversions.length,1);a.equal(v.conversions[0].quoteId,'a');
 a.equal(w.conversions.length,1);a.equal(w.conversions[0].quoteId,'b');a.equal(w.assets[1].availableMinor,'75');
 a.deepEqual(Object.keys(v).sort(),['assets','conversions','mode','pendingRedemptionUsdMinor']);
 a.deepEqual(ledger.manifest(),before);
}));
test('cancelled reservation releases available units, confirmed conversion adds Coin once',()=>fixture((ledger,own)=>{
 ledger.appendBatch([quote('alice','a',10),accept('alice','a',11),settle('a',12,'swap_cancelled')]);
 a.equal(own('alice').assets[0].availableMinor,'900');a.equal(own('alice').assets[0].reservedMinor,'0');
 const events=[quote('alice','c',20),accept('alice','c',21),settle('c',22)];
 ledger.appendBatch(events);ledger.appendBatch(events);
 a.equal(own('alice').assets[0].availableMinor,'850');a.equal(own('alice').assets[1].availableMinor,'75');
}));
test('portfolio denies missing actor, treasury and production and gives empty unknown owner',()=>fixture((ledger,own)=>{
 for(const actor of [undefined,null,'','treasury','bad owner'])a.throws(()=>own(actor),/AUTH_REQUIRED/);
 a.throws(()=>read({environment:'production',ledger,verifiedActor:'alice'}),/SANDBOX_ONLY/);
 a.ok(own('nobody').assets.every(x=>x.totalMinor==='0'));a.deepEqual(own('nobody').conversions,[]);
}));
test('burned Digital awaiting payout is reported as own separate obligation, not spendable units',()=>fixture((ledger,own)=>{
 a.equal(own('alice').pendingRedemptionUsdMinor,'40');a.equal(own('alice').assets[0].availableMinor,'860');
 a.equal(own('bob').pendingRedemptionUsdMinor,'0');
},{...seed,digitalEvents:[...seed.digitalEvents,{eventId:'r',kind:'redemption_reserved',owner:'alice',amountMinor:'40',redemptionId:'r'},{eventId:'burn',kind:'burn_confirmed',redemptionId:'r'}]}));
test('malformed own balances and duplicate owner records fail closed',()=>{
 const snapshot={manifest:{format:'synthetic-digital-coin-manifest-v1'},projection:{mode:'sandbox',digital:{mode:'sandbox',accounts:[{owner:'alice',available:'-1',reserved:'0'}],redemptions:[]},coin:{mode:'sandbox',asset:'COIN_TEST',accounts:[]},quotes:[]}};
 const args={environment:'sandbox',verifiedActor:'alice',ledger:{reconciliationSnapshot:()=>snapshot}};
 a.throws(()=>read(args),/INVALID_SNAPSHOT/);snapshot.projection.digital.accounts=[{owner:'alice',available:'1',reserved:'0'},{owner:'alice',available:'1',reserved:'0'}];a.throws(()=>read(args),/INVALID_SNAPSHOT/);
});
