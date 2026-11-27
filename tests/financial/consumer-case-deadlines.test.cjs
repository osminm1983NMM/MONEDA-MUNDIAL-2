'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {reviewCaseDeadlines:review}=require('../../financial-sandbox/consumer-case-deadlines.cjs');
const {openConsumerCaseLab:open}=require('../../financial-sandbox/consumer-case-lab.cjs');
const ev=(kind,eventId,role,actor,at,extra={})=>({caseId:'c1',kind,eventId,role,actor,at,...extra});
const received=ev('received','r','support','s',100,{owner:'alice',orderRef:null,caseType:'error',channel:'phone',locale:'es',intakeRef:'in'});
const investigate=ev('investigating','i','investigator','i1',110);
const determine=ev('determined','d','investigator','i1',150,{outcome:'remedy_required',decisionRef:'decision'});
const notice=ev('notice_recorded','n','support','s',170,{noticeRef:'notice'});
const observed=ev('remedy_observed','o','operations','o1',180,{remedyRef:'refund-fixture'});
const verified=ev('remedy_verified','v','reconciliation','v1',210,{verificationRef:'verify'});
const closed=ev('closed','c','support','s',220);
const full=[received,investigate,determine,notice,observed,verified,closed];
const plan=(stage,dueAt)=>({caseId:'c1',stage,dueAt,policyRef:'policy-fixture',basisRef:'basis-fixture'});
const plans=[plan('determination',140),plan('notice',170),plan('remedy_verification',200)];
const run=(events,asOf,patch={})=>review({environment:'sandbox',events,asOf,warningMs:10,plans,...patch});
test('exact due boundary, approaching and overdue alerts do not change the case',()=>{
 a.equal(run([received],129).items[0].status,'pending');
 a.equal(run([received],130).items[0].status,'due_soon');
 a.equal(run([received],140).items[0].status,'due_soon');
 a.equal(run([received],141).items[0].status,'overdue');
 a.equal(run([received],141).attention.length,1);
});
test('historical lateness remains visible after closure and exact completion deadline is on time',()=>{
 const x=run(full,300);
 a.deepEqual(x.items.map(i=>i.status),['completed_late','completed_on_time','completed_late']);
 a.deepEqual(x.attention.map(i=>i.stage),['determination','remedy_verification']);
});
test('uncertain investigation never resets original deadline or counts as final determination',()=>{
 const uncertain={...determine,outcome:'uncertain'};
 const second={...investigate,eventId:'i2',at:160};
 const x=run([received,investigate,uncertain,second],170);
 a.equal(x.items[0].status,'overdue');a.equal(x.items[0].completedAt,null);
 a.equal(x.items[1].status,'not_yet_applicable');
});
test('missing deadlines require review, never imply no obligations; no-remedy has no verification stage',()=>{
 const no={...determine,outcome:'no_remedy'};
 const x=run([received,investigate,no,notice],180,{plans:[]});
 a.deepEqual(x.items.map(i=>i.stage),['determination','notice']);
 a.ok(x.items.every(i=>i.status==='needs_deadline_review'));
});
test('bad schedule, duplicate stage, unknown case, future event and production fail closed',()=>{
 a.throws(()=>run([received],99),/FUTURE_HISTORY/);
 a.throws(()=>run([received],110,{plans:[...plans,plans[0]]}),/DUPLICATE_PLAN/);
 a.throws(()=>run([received],110,{plans:[{...plans[0],caseId:'unknown'}]}),/INVALID_PLAN_BASIS/);
 a.throws(()=>run([received],110,{plans:[plan('notice',99)]}),/INVALID_PLAN_BASIS/);
 a.throws(()=>run([received],110,{warningMs:-1}),/INVALID_CLOCK/);
 a.throws(()=>run([received],110,{environment:'production'}),/SANDBOX_ONLY/);
});
test('deadline inventory from persisted history is reproducible after reopening without mutation',()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-consumer-deadline-')),options={environment:'sandbox',path:join(dir,'cases.sqlite')};
 let lab=open({...options,initialize:true});
 try{
  lab.appendBatch(full.slice(0,4));const before=lab.audit();
  const report=lab.deadlineReview({plans,asOf:205,warningMs:10});
  a.equal(report.items[2].status,'overdue');a.deepEqual(lab.audit(),before);
  lab.close();lab=open(options);
  a.deepEqual(lab.deadlineReview({plans,asOf:205,warningMs:10}),report);
  lab.appendBatch(full.slice(4));a.equal(lab.deadlineReview({plans,asOf:300,warningMs:10}).items[2].status,'completed_late');
 }finally{lab.close();fs.rmSync(dir,{recursive:true,force:true});}
});
