'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {SandboxFinance}=require('../../financial-sandbox/core.cjs');
const {createMockProvider}=require('../../financial-sandbox/mock-provider.cjs');
function fixture(){
 let now=1000000,i=0;const clock=()=>now;
 const provider=createMockProvider({secret:'synthetic-secret-not-a-real-key-123456',clock});
 const finance=new SandboxFinance({environment:'sandbox',provider,clock,id:()=>('id'+(++i)),
  requireDisclosure:true,policy:()=>({identity:'verified',sanctions:'clear',risk:'allow',dailyLimitCents:500000})});
 const quote=()=>finance.quote('alice',{destination:'HN',amountCents:10000,method:'bank'});
 const q=quote(),request={quoteId:q.id,requestId:'request1',beneficiaryRef:'beneficiary1'};
 const show=(x=request,actor='alice')=>finance.presentDisclosure(actor,{quoteId:x.quoteId,beneficiaryRef:x.beneficiaryRef,locale:'es'});
 const create=(sha,x=request)=>finance.create('alice',{...x,disclosureSha256:sha});
 return {finance,provider,quote,q,request,show,create,tick:n=>{now+=n}};
}
test('gated creation requires matching disclosure and rejects another owner or changed beneficiary',()=>{
 const f=fixture(),{sha256}=f.show();
 a.throws(()=>f.create(undefined),/DISCLOSURE_REQUIRED/);
 a.throws(()=>f.create('a'.repeat(64)),/DISCLOSURE_MISMATCH/);
 a.throws(()=>f.create(sha256,{...f.request,beneficiaryRef:'other'}),/DISCLOSURE_MISMATCH/);
 a.throws(()=>f.show(f.request,'bob'),/QUOTE_UNAVAILABLE/);
 const o=f.create(sha256);a.equal(f.finance.getDisclosure('alice',o.id).sha256,sha256);
 a.throws(()=>f.finance.getDisclosure('bob',o.id),/NOT_FOUND/);
});
test('changing quote or expiry requires a new presentation; failed acceptance does not consume quote',()=>{
 const f=fixture(),{sha256}=f.show(),q2=f.quote(),req2={...f.request,quoteId:q2.id};
 a.throws(()=>f.create(sha256,req2),/DISCLOSURE_MISMATCH/);
 const newPresentation=f.show(req2);a.equal(f.create(newPresentation.sha256,req2).quoteId,q2.id);
 f.tick(300000);a.throws(()=>f.create(sha256,{...f.request,requestId:'request2'}),/QUOTE_UNAVAILABLE/);
});
test('acceptance freezes server fields and exact replay returns original order even after expiry',()=>{
 const f=fixture(),p=f.show();p.record.totalCents=1;
 const o=f.create(p.sha256);a.equal(f.finance.getDisclosure('alice',o.id).record.totalCents,f.q.totalCents);
 f.tick(300001);a.equal(f.create(p.sha256).id,o.id);
 a.throws(()=>f.create('a'.repeat(64)),/IDEMPOTENCY_CONFLICT/);
});
test('receipt only follows verified matching funding and does not imply beneficiary payment',async()=>{
 const f=fixture(),o=f.create(f.show().sha256);
 a.equal(f.finance.getReceipt('alice',o.id),null);
 const pending=await f.finance.submit('alice',o.id,'funding');
 a.equal(f.finance.getReceipt('alice',o.id),null);
 const bad=f.provider.event(pending.fundingRef,'funding_confirmed','bad',{amountMinor:1});
 a.throws(()=>f.finance.receive(bad.raw,bad.signature),/EVENT_MISMATCH/);
 const good=f.provider.event(pending.fundingRef,'funding_confirmed','good');
 a.throws(()=>f.finance.receive(good.raw,'0'.repeat(64)),/INVALID_SIGNATURE/);
 a.equal(f.finance.getReceipt('alice',o.id),null);
 f.finance.receive(good.raw,good.signature);
 const receipt=f.finance.getReceipt('alice',o.id);
 a.equal(receipt.kind,'funding_confirmed_not_payout');a.equal(receipt.paidMinor,f.q.totalCents);
 a.equal(receipt.disclosureSha256,f.finance.getDisclosure('alice',o.id).sha256);
 a.throws(()=>f.finance.getReceipt('bob',o.id),/NOT_FOUND/);
 receipt.paidMinor=1;
 a.equal(f.finance.receive(good.raw,good.signature).status,'duplicate');
 a.equal(f.finance.getReceipt('alice',o.id).paidMinor,f.q.totalCents);
 const payout=await f.finance.submit('alice',o.id,'payout');
 const failed=f.provider.event(payout.payoutRef,'payout_failed','fail');
 f.finance.receive(failed.raw,failed.signature);
 a.equal(f.finance.getReceipt('alice',o.id).paymentEventId,'good');
 a.equal(f.finance.reconcile().balanced,true);
});
test('funding evidence before acceptance and failed funding cannot create a receipt',async()=>{
 const f=fixture(),o=f.create(f.show().sha256);
 const pending=await f.finance.submit('alice',o.id,'funding');
 const early=f.provider.event(pending.fundingRef,'funding_confirmed','early',{timestamp:999999});
 a.throws(()=>f.finance.receive(early.raw,early.signature),/INVALID_PAYMENT_EVIDENCE/);
 const failed=f.provider.event(pending.fundingRef,'funding_failed','failure');
 f.finance.receive(failed.raw,failed.signature);
 a.equal(f.finance.getReceipt('alice',o.id),null);
 a.equal(f.finance.reconcile().postings,0);
});
