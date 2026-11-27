'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {openDigitalCoinLedger}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const {createLedgerPortfolioService}=require('../../financial-sandbox/digital-coin-portfolio-service.cjs');
const {createPortfolioHttp}=require('../../financial-sandbox/digital-coin-portfolio-http.cjs');
const {createExpoPortfolio}=require('../../financial-sandbox/mobile/digital-coin-portfolio-expo.js');
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'900'},
 {eventId:'ib',kind:'issue_confirmed',owner:'bob',amountMinor:'100'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const events=[
 {eventId:'q',kind:'quote_created',at:10,quoteId:'q',owner:'alice',direction:'digital_to_coin',digitalMinor:'200',coinMinor:'300',expiresAt:100},
 {eventId:'a',kind:'quote_accepted',at:11,quoteId:'q',owner:'alice'},
 {eventId:'c',kind:'swap_confirmed',at:12,quoteId:'q'}
];
const report=(asset,source,reportId)=>({mode:'sandbox',cutId:'initial',scope:'all-test-accounts',source,reportId,asset,complete:true});
function evidence(ledger){
 return {cutId:'initial',internalSha256:ledger.manifest().sha256,reports:{
  reserve:{...report('USD','reserve-bank-fixture','bank-1'),eligibleMinor:'2000'},
  digital:{...report('DIGITAL_TEST','digital-custody-fixture','digital-1'),outstandingMinor:'2000',balances:[{owner:'alice',totalMinor:'900'},{owner:'bob',totalMinor:'100'},{owner:'treasury',totalMinor:'1000'}]},
  coin:{...report('COIN_TEST','coin-custody-fixture','coin-1'),outstandingMinor:'1000',balances:[{owner:'treasury',totalMinor:'1000'}]}
 },priceProofs:[{price:{mode:'sandbox',source:'synthetic-price-fixture',priceId:'p1',digitalMinor:'2',coinMinor:'3',observedAt:0,validUntil:100},request:{eventId:'q',quoteId:'q',owner:'alice',direction:'digital_to_coin',inputMinor:'200',minimumOutputMinor:'300',ttlMs:90}}]};
}
const React={createElement:(type,props,...children)=>({type,props,children})},Native={View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'};
const flatten=node=>typeof node==='string'?node:node?.children?.map(flatten).join(' ')||'';
async function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-wallet-e2e-')),path=join(dir,'ledger.sqlite');
 let ledger=openDigitalCoinLedger({environment:'sandbox',path,initialize:true,seed,requireReconciliation:true,requireVerifiedPricing:true});
 const sessions=new Map([['a','alice'],['b','bob']]),views=[];
 const service=createLedgerPortfolioService({environment:'sandbox',verifySession:async token=>sessions.has(token)?{environment:'sandbox',actor:sessions.get(token)}:null,ledger:{reconciliationSnapshot:()=>ledger.reconciliationSnapshot()}});
 const http=createPortfolioHttp({environment:'sandbox',service});
 const expo=createExpoPortfolio({React,Native,environment:'sandbox',enabled:true,sandboxOrigin:'https://sandbox.invalid',expoFetch:(url,init)=>http(new Request(url,init)),onChange:v=>views.push(v)});
 const refresh=async()=>{await expo.refresh(views.at(-1).revision);return views.at(-1);};
 const render=()=>{const tree=expo.render();return flatten(tree.type(tree.props));};
 try{await fn({get ledger(){return ledger;},path,dir,sessions,expo,refresh,render,reopen(){ledger.close();ledger=openDigitalCoinLedger({environment:'sandbox',path});}});}
 finally{expo.dispose();ledger.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('priced and reconciled SQLite conversion reaches the mobile wallet exactly once; reads never mutate history',async()=>fixture(async f=>{
 f.expo.setSession('a');let v=await f.refresh();a.equal(v.value.assets[0].availableMinor,'900');a.equal(v.value.assets[1].availableMinor,'0');
 const proof=evidence(f.ledger);a.equal(f.ledger.appendBatch(events,proof).status,'applied');a.equal(f.ledger.appendBatch(events).status,'duplicate');
 const before=f.ledger.manifest();v=await f.refresh();a.equal(v.state,'ready');a.equal(v.value.assets[0].availableMinor,'700');a.equal(v.value.assets[1].availableMinor,'300');a.equal(v.value.conversions[0].state,'confirmed');a.match(f.render(),/Confirmada/);
 a.deepEqual(f.ledger.manifest(),before);
 f.reopen();v=await f.refresh();a.equal(v.value.assets[1].availableMinor,'300');a.deepEqual(f.ledger.manifest(),before);
 f.expo.setSession('b');a.doesNotMatch(f.render(),/Confirmada/);v=await f.refresh();a.equal(v.value.assets[0].availableMinor,'100');a.equal(v.value.assets[1].availableMinor,'0');a.deepEqual(v.value.conversions,[]);
 f.sessions.delete('b');v=await f.refresh();a.equal(v.state,'signed_out');a.equal(v.value,undefined);
 a.deepEqual(f.ledger.manifest(),before);
}));
test('rejected reconciliation or pricing cannot appear as new balance or conversion in wallet',async()=>fixture(async f=>{
 const proof=evidence(f.ledger);proof.reports.reserve.eligibleMinor='1999';
 a.throws(()=>f.ledger.appendBatch(events,proof),/RECONCILIATION_DISCREPANCY/);
 const bad=evidence(f.ledger);bad.priceProofs[0].request.inputMinor='201';
 a.throws(()=>f.ledger.appendBatch(events,bad));
 f.expo.setSession('a');const v=await f.refresh();a.equal(v.value.assets[0].availableMinor,'900');a.equal(v.value.assets[1].availableMinor,'0');a.deepEqual(v.value.conversions,[]);a.deepEqual(f.ledger.counts(),{events:0});
}));
test('damaged audit history fails closed through server, transport and mobile presentation',async()=>fixture(async f=>{
 f.ledger.appendBatch(events,evidence(f.ledger));f.expo.setSession('a');a.equal((await f.refresh()).state,'ready');
 const db=new DatabaseSync(f.path);try{db.exec('DROP TRIGGER receipts_no_delete; DELETE FROM reconciliation_receipts');}finally{db.close();}
 const v=await f.refresh();a.equal(v.state,'error');a.equal(v.value,undefined);a.doesNotMatch(f.render(),/Confirmada/);a.match(f.render(),/No se pudo consultar/);
}));
