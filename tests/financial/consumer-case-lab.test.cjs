'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),{join}=require('node:path'),{tmpdir}=require('node:os');
const {openConsumerCaseLab:open,projectConsumerCases:project}=require('../../financial-sandbox/consumer-case-lab.cjs');
const e=(kind,eventId,role,actor,at,extra={},caseId='c1')=>({caseId,kind,eventId,role,actor,at,...extra});
const received=e('received','r','support','s1',100,{owner:'alice',orderRef:null,caseType:'cancellation',channel:'phone',locale:'es',intakeRef:'intake1'});
const investigating=e('investigating','i','investigator','i1',110);
const decision=e('determined','d','investigator','i1',120,{outcome:'remedy_required',decisionRef:'decision1'});
const notice=e('notice_recorded','n','support','s1',130,{noticeRef:'notice1'});
const observed=e('remedy_observed','o','operations','o1',140,{remedyRef:'provider-fixture1'});
const verified=e('remedy_verified','v','reconciliation','v1',150,{verificationRef:'recon-fixture1'});
const closed=e('closed','c','support','s1',160);
const full=[received,investigating,decision,notice,observed,verified,closed];
function fixture(fn){
 const dir=fs.mkdtempSync(join(tmpdir(),'mwd-consumer-')),options={environment:'sandbox',path:join(dir,'cases.sqlite')};
 let lab=open({...options,initialize:true});
 try{fn({options,get lab(){return lab;},reopen(){lab.close();lab=open(options);return lab;}});}
 finally{lab.close();fs.rmSync(dir,{recursive:true,force:true});}
}
test('oral intake with unknown order reference is retained and closure requires independently verified remedy',()=>{
 const pending=project(full.slice(0,5))[0];a.equal(pending.state,'verification_pending');a.equal(pending.receivedAt,100);
 a.throws(()=>project([...full.slice(0,5),closed]),/INVALID_CASE_TRANSITION/);
 a.throws(()=>project([...full.slice(0,5),{...verified,actor:'o1'}]),/INDEPENDENT_REVIEW_REQUIRED/);
 a.throws(()=>project([...full.slice(0,4),{...observed,actor:'i1'}]),/INDEPENDENT_REVIEW_REQUIRED/);
 a.equal(project(full)[0].state,'closed');
});
test('uncertain case must return to investigation; no-remedy case still requires notice',()=>{
 const uncertain={...decision,outcome:'uncertain'};
 a.throws(()=>project([received,investigating,uncertain,notice]),/INVALID_CASE_TRANSITION/);
 const review={...investigating,eventId:'i2',at:121};
 const none={...decision,eventId:'d2',at:122,outcome:'no_remedy'};
 a.throws(()=>project([received,investigating,uncertain,review,none,closed]),/INVALID_CASE_TRANSITION/);
 a.equal(project([received,investigating,uncertain,review,none,notice,closed])[0].state,'closed');
});
test('role, chronology, exact fields and event conflicts fail closed',()=>{
 a.throws(()=>project([received,{...investigating,role:'support'}]),/ROLE_NOT_ALLOWED/);
 a.throws(()=>project([received,{...investigating,at:99}]),/NONMONOTONIC_TIME/);
 a.throws(()=>project([{...received,cardNumber:'123'}]),/INVALID_EVENT/);
 a.throws(()=>project([received,{...received,owner:'bob'}]),/EVENT_ID_CONFLICT/);
 a.deepEqual(project([...full,...full]),project(full));
});
test('durable intake, atomic rollback, reopen and retry preserve original receipt time',()=>fixture(f=>{
 a.equal(f.lab.appendBatch([received,investigating]).added,2);
 a.throws(()=>f.lab.appendBatch([decision,closed]),/INVALID_CASE_TRANSITION/);
 a.equal(f.reopen().audit().events.length,2);
 a.equal(f.lab.appendBatch(full).added,5);a.equal(f.lab.appendBatch(full).status,'duplicate');
 a.equal(f.reopen().audit().cases[0].receivedAt,100);
 a.equal(f.lab.audit().events.length,7);
}));
test('owner-scoped view hides other cases and internal references; no mutation or production mode',()=>fixture(f=>{
 f.lab.appendBatch(full);
 f.lab.appendBatch([{...received,eventId:'r2',caseId:'c2',owner:'bob',channel:'written',locale:'en',intakeRef:'intake2'}]);
 a.deepEqual(f.lab.listForOwner('alice'),[{caseId:'c1',caseType:'cancellation',receivedAt:100,lastAt:160,state:'closed',locale:'es'}]);
 a.equal(f.lab.listForOwner('bob')[0].caseId,'c2');a.deepEqual(f.lab.listForOwner('other'),[]);
 a.throws(()=>open({...f.options,environment:'production'}),/SANDBOX_ONLY/);
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.options.path);
 try{a.throws(()=>db.exec('DELETE FROM events'),/APPEND_ONLY/);}finally{db.close();}
}));
test('separate connections cannot close an unresolved case or duplicate a recorded outcome',()=>fixture(f=>{
 const other=open(f.options);
 try{
  f.lab.appendBatch(full.slice(0,4));
  a.throws(()=>other.appendBatch([closed]),/INVALID_CASE_TRANSITION/);
  other.appendBatch([observed,verified,closed]);
  a.equal(f.lab.appendBatch([observed,verified,closed]).status,'duplicate');
  a.equal(f.lab.audit().cases[0].state,'closed');
 }finally{other.close();}
}));
