'use strict';
// Reproducible synthetic wallet fixture, never Auth identifiers or real assets.
// Generate only in a disposable private directory; stdout is safe test data.
// Hosting operator must explicitly bind fixture A/B to the existing LAB users.
const {mkdtempSync,rmSync}=require('node:fs');
const {join}=require('node:path'),{tmpdir}=require('node:os');
const {openDigitalCoinLedger}=require('./digital-coin-ledger.cjs');
const {exportWalletSnapshot}=require('./wallet-snapshot-export.cjs');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
function buildWalletAcceptanceFixture(exportedAt){
 const dir=mkdtempSync(join(tmpdir(),'mwd-wallet-acceptance-'));
 let ledger;
 try{
  const seed={capMinor:'1000',digitalEvents:[
   {eventId:'fund',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
   {eventId:'issue-a',kind:'issue_confirmed',owner:A,amountMinor:'900'},
   {eventId:'issue-b',kind:'issue_confirmed',owner:B,amountMinor:'100'},
   {eventId:'issue-treasury',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
  ],coinEvents:[{eventId:'mint',kind:'mint_confirmed',amountMinor:'1000'}]};
  ledger=openDigitalCoinLedger({environment:'sandbox',path:join(dir,'source.sqlite'),initialize:true,seed,requireReconciliation:true,requireVerifiedPricing:true});
  const report=(asset,source,reportId)=>({mode:'sandbox',cutId:'initial',scope:'all-test-accounts',source,reportId,asset,complete:true});
  const events=[
   {eventId:'q',kind:'quote_created',at:10,quoteId:'acceptance-a',owner:A,direction:'digital_to_coin',digitalMinor:'200',coinMinor:'300',expiresAt:100},
   {eventId:'a',kind:'quote_accepted',at:11,quoteId:'acceptance-a',owner:A},
   {eventId:'c',kind:'swap_confirmed',at:12,quoteId:'acceptance-a'}
  ];
  ledger.appendBatch(events,{cutId:'initial',internalSha256:ledger.manifest().sha256,reports:{
   reserve:{...report('USD','reserve-bank-fixture','bank-1'),eligibleMinor:'2000'},
   digital:{...report('DIGITAL_TEST','digital-custody-fixture','digital-1'),outstandingMinor:'2000',balances:[{owner:A,totalMinor:'900'},{owner:B,totalMinor:'100'},{owner:'treasury',totalMinor:'1000'}]},
   coin:{...report('COIN_TEST','coin-custody-fixture','coin-1'),outstandingMinor:'1000',balances:[{owner:'treasury',totalMinor:'1000'}]}
  },priceProofs:[{price:{mode:'sandbox',source:'synthetic-price-fixture',priceId:'p1',digitalMinor:'2',coinMinor:'3',observedAt:0,validUntil:100},request:{eventId:'q',quoteId:'acceptance-a',owner:A,direction:'digital_to_coin',inputMinor:'200',minimumOutputMinor:'300',ttlMs:90}}]});
  const path=join(dir,'snapshot.sqlite'),expected=ledger.backup(path);ledger.close();ledger=null;
  return exportWalletSnapshot({environment:'sandbox',enabled:true,path,expected,enrolledActors:[A,B],exportedAt});
 }finally{ledger?.close();rmSync(dir,{recursive:true,force:true});}
}
module.exports={buildWalletAcceptanceFixture};
