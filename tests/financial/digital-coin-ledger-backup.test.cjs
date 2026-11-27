'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const fs=require('node:fs');const {join}=require('node:path');const {tmpdir}=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {openDigitalCoinLedger:open,verifyDigitalCoinBackup:verify}=require('../../financial-sandbox/digital-coin-ledger.cjs');
const seed={capMinor:'1000',digitalEvents:[
 {eventId:'f',kind:'reserve_confirmed',amountMinor:'2000',asset:'USD',purpose:'digital_reserve'},
 {eventId:'ia',kind:'issue_confirmed',owner:'alice',amountMinor:'1000'},
 {eventId:'it',kind:'issue_confirmed',owner:'treasury',amountMinor:'1000'}
],coinEvents:[{eventId:'m',kind:'mint_confirmed',amountMinor:'1000'}]};
const events=[
 {eventId:'q',kind:'quote_created',at:10,quoteId:'q',owner:'alice',direction:'digital_to_coin',digitalMinor:'200',coinMinor:'300',expiresAt:100},
 {eventId:'a',kind:'quote_accepted',at:11,quoteId:'q',owner:'alice'},
 {eventId:'c',kind:'swap_confirmed',at:12,quoteId:'q'}
];
function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-swap-backup-')),options={environment:'sandbox',path:join(dir,'original.sqlite')},copy=join(dir,'copy.sqlite');
 let ledger=open({...options,initialize:true,seed});
 try{fn({options,copy,ledger,close(){ledger.close();ledger=null;}});}
 finally{ledger?.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('restore independent copy of pending reservation, continue settlement and replay after source removed',()=>fixture(f=>{
 f.ledger.appendBatch(events.slice(0,2));const before=f.ledger.get();
 const expected=f.ledger.manifest();a.deepEqual(f.ledger.backup(f.copy),expected);
 a.deepEqual(verify({environment:'sandbox',path:f.copy,expected}),expected);
 f.close();fs.unlinkSync(f.options.path);
 const restored=open({environment:'sandbox',path:f.copy});
 try{
  a.deepEqual(restored.get(),before);
  const paid=restored.appendBatch([events[2]]).projection;
  a.equal(paid.digital.accounts[0].available,'800');
  a.equal(paid.coin.accounts.find(x=>x.owner==='alice').available,'300');
  a.equal(restored.appendBatch(events).status,'duplicate');
  a.deepEqual(restored.counts(),{events:3});
 }finally{restored.close();}
}));
test('valid but truncated copy fails independently retained manifest, even with same supply and coverage',()=>fixture(f=>{
 f.ledger.appendBatch(events);const expected=f.ledger.backup(f.copy);
 const db=new DatabaseSync(f.copy);
 try{db.exec('DROP TRIGGER events_no_delete; DELETE FROM events WHERE sequence=3');}finally{db.close();}
 a.throws(()=>verify({environment:'sandbox',path:f.copy,expected}),/BACKUP_MISMATCH/);
}));
test('never overwrite source or existing backup; reject wrong manifest and production',()=>fixture(f=>{
 f.ledger.appendBatch(events);const expected=f.ledger.backup(f.copy);
 a.throws(()=>f.ledger.backup(f.options.path),/EEXIST/);
 a.throws(()=>f.ledger.backup(f.copy),/EEXIST/);
 a.throws(()=>verify({environment:'sandbox',path:f.copy,expected:{...expected,obligationsUsdMinor:'0'}}),/BACKUP_MISMATCH/);
 a.throws(()=>verify({environment:'sandbox',path:f.copy,expected:{...expected,sha256:'bad'}}),/INVALID_MANIFEST/);
 a.throws(()=>verify({environment:'production',path:f.copy,expected}),/SANDBOX_ONLY/);
 a.deepEqual(verify({environment:'sandbox',path:f.copy,expected}),expected);
}));
