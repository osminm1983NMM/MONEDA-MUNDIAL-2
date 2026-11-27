'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {openDigitalCoinLedger,openDigitalCoinWalletSnapshot}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const {createWalletSnapshotRuntime}=require('../../financial-sandbox/wallet-snapshot-runtime.cjs');
const actor='00000000-0000-4000-8000-000000000001';
const project='https://tfamyuqqpenilnovqjpp.supabase.co';
const token='e30.'+Buffer.from(JSON.stringify({iss:project+'/auth/v1',role:'authenticated',is_anonymous:false,sub:actor})).toString('base64url')+'.test';
const seed={capMinor:'1000',digitalEvents:[{eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},{eventId:'i',kind:'issue_confirmed',owner:actor,amountMinor:'900'},{eventId:'t',kind:'issue_confirmed',owner:'treasury',amountMinor:'1100'}],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
async function fixture(fn,priced=true){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-wallet-snapshot-')),path=join(dir,'snapshot.sqlite');
 let ledger;
 try{
  ledger=openDigitalCoinLedger({environment:'sandbox',path:join(dir,'source.sqlite'),initialize:true,seed,requireReconciliation:true,requireVerifiedPricing:priced});
  const expected=ledger.backup(path);ledger.close();ledger=null;
  await fn({environment:'sandbox',path,expected});
 }finally{ledger?.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('verified snapshot exposes read-only API, exact manifest and no write capability',async()=>fixture(async args=>{
 const reader=openDigitalCoinWalletSnapshot(args);try{
  a.equal(reader.appendBatch,undefined);a.deepEqual(reader.reconciliationSnapshot().manifest,args.expected);a.equal(reader.verifiedPricingRequired(),true);
 }finally{reader.close();reader.close();}
 a.throws(()=>reader.reconciliationSnapshot(),/LEDGER_CLOSED/);
}));
test('wrong manifest or ungated backup fails before network startup',async()=>{
 await fixture(async args=>{
  a.throws(()=>openDigitalCoinWalletSnapshot({...args,expected:{...args.expected,sha256:'0'.repeat(64)}}),/BACKUP_MISMATCH/);
  a.throws(()=>createWalletSnapshotRuntime({...args,enabled:false}),/WALLET_LAB_DISABLED/);
 });
 await fixture(async args=>a.throws(()=>openDigitalCoinWalletSnapshot(args),/VERIFIED_PRICING_REQUIRED/),false);
});
test('snapshot runtime reads persisted balance via TCP and never changes source manifest',async()=>fixture(async args=>{
 const runtime=createWalletSnapshotRuntime({...args,enabled:true,publishableKey:'sb_publishable_synthetic_test_only',enrolledActors:[actor],fetchImpl:async()=>new Response(JSON.stringify({actor,environment:'sandbox'}),{headers:{'content-type':'application/json'}})});
 try{
  const origin=await runtime.start();const res=await fetch(origin+'/v1/sandbox/wallet/portfolio',{headers:{authorization:'Bearer '+token}});
  a.equal(res.status,200);a.equal((await res.json()).assets[0].availableMinor,'900');
 }finally{await runtime.close();}
 const check=openDigitalCoinWalletSnapshot(args);try{a.deepEqual(check.reconciliationSnapshot().manifest,args.expected);}finally{check.close();}
}));
