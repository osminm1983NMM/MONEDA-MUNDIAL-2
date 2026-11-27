'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {openDigitalCoinLedger}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const {exportWalletSnapshot:exportSnapshot}=require('../../financial-sandbox/wallet-snapshot-export.cjs');
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const seed={capMinor:'1000',digitalEvents:[{eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},{eventId:'a',kind:'issue_confirmed',owner:actor,amountMinor:'900'},{eventId:'b',kind:'issue_confirmed',owner:other,amountMinor:'100'},{eventId:'t',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-wallet-export-')),path=join(dir,'snapshot.sqlite');
 let ledger;try{
  ledger=openDigitalCoinLedger({environment:'sandbox',path:join(dir,'source.sqlite'),initialize:true,seed,requireReconciliation:true,requireVerifiedPricing:true});
  const expected=ledger.backup(path);ledger.close();ledger=null;
  fn({environment:'sandbox',enabled:true,path,expected,enrolledActors:[actor],exportedAt:'2026-11-27T12:00:00.000Z'});
 }finally{ledger?.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('export includes only explicitly enrolled actor and exact point-in-time balance',()=>fixture(args=>{
 const result=exportSnapshot(args);
 a.equal(result.mode,'sandbox');a.equal(result.kind,'immutable_wallet_snapshot');a.equal(result.exportedAt,args.exportedAt);a.equal(result.sourceManifestSha256,args.expected.sha256);
 a.equal(result.sourceEventCount,0);a.equal(result.portfolios.length,1);a.equal(result.portfolios[0].actor,actor);a.equal(result.portfolios[0].portfolio.assets[0].availableMinor,'900');
 a.doesNotMatch(JSON.stringify(result),/treasury|reserveUsdMinor|source.sqlite/);a.ok(!JSON.stringify(result).includes(other));
}));
test('multi-actor export is deterministic and separate for each owner',()=>fixture(args=>{
 const first=exportSnapshot({...args,enrolledActors:[other,actor]});
 const second=exportSnapshot({...args,enrolledActors:[actor,other]});
 a.deepEqual(first,second);a.deepEqual(first.portfolios.map(p=>p.portfolio.assets[0].availableMinor),['900','100']);
}));
test('rejects unsafe enrollment, invalid time, disabled runtime and altered manifest',()=>fixture(args=>{
 for(const enrolledActors of [[],[actor,actor],['treasury']])a.throws(()=>exportSnapshot({...args,enrolledActors}),/INVALID_ENROLLMENT/);
 a.throws(()=>exportSnapshot({...args,exportedAt:'2026-02-30T12:00:00.000Z'}),/INVALID_EXPORT_TIME/);
 a.throws(()=>exportSnapshot({...args,enabled:false}),/WALLET_EXPORT_DISABLED/);
 a.throws(()=>exportSnapshot({...args,expected:{...args.expected,sha256:'0'.repeat(64)}}),/BACKUP_MISMATCH/);
}));
