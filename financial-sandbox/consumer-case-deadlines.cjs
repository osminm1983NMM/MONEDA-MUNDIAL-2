'use strict';
// Read-only operational alert inventory for synthetic cases. Deadlines are
// explicit fixtures supplied by a trusted planner, not calculated legal rights.
const {projectConsumerCases}=require('./consumer-case-lab.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const time=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const stages=['determination','notice','remedy_verification'];
function reviewCaseDeadlines({environment,events,plans,asOf,warningMs}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!time(asOf)||!time(warningMs)||warningMs>30*86400000)fail('INVALID_CLOCK');
 const cases=projectConsumerCases(events);
 if(events.some(e=>e.at>asOf))fail('FUTURE_HISTORY');
 if(!Array.isArray(plans)||plans.length>30000)fail('INVALID_PLANS');
 const byCase=new Map(cases.map(c=>[c.caseId,c])),byStage=new Map(),completion=new Map();
 const key=(caseId,stage)=>JSON.stringify([caseId,stage]);
 for(const e of events){
  const stage=e.kind==='determined'&&e.outcome!=='uncertain'?'determination':e.kind==='notice_recorded'?'notice':e.kind==='remedy_verified'?'remedy_verification':null;
  if(stage){const k=key(e.caseId,stage);if(!completion.has(k))completion.set(k,e.at);}
 }
 for(const plan of plans){
  if(!exact(plan,['caseId','stage','dueAt','policyRef','basisRef'])||!id(plan.caseId)||!stages.includes(plan.stage)||
   !time(plan.dueAt)||!id(plan.policyRef)||!id(plan.basisRef))fail('INVALID_PLAN');
  const c=byCase.get(plan.caseId);
  if(!c||plan.dueAt<c.receivedAt)fail('INVALID_PLAN_BASIS');
  const k=key(plan.caseId,plan.stage);
  if(byStage.has(k))fail('DUPLICATE_PLAN');
  byStage.set(k,plan);
 }
 const items=[];
 for(const c of cases){
  // These stages model the local fixture workflow only, not which obligations
  // a specific consumer or regulatory regime has.
  const required=['determination'];
  if(c.outcome==='no_remedy'||c.outcome==='remedy_required')required.push('notice');
  if(c.outcome==='remedy_required')required.push('remedy_verification');
  for(const stage of stages){
   const k=key(c.caseId,stage),plan=byStage.get(k),completedAt=completion.get(k)??null;
   if(!required.includes(stage)&&!plan)continue;
   if(!required.includes(stage)){items.push({caseId:c.caseId,stage,status:'not_yet_applicable',dueAt:plan.dueAt,completedAt});continue;}
   if(!plan){items.push({caseId:c.caseId,stage,status:'needs_deadline_review',dueAt:null,completedAt});continue;}
   const status=completedAt!==null?(completedAt>plan.dueAt?'completed_late':'completed_on_time'):
    asOf>plan.dueAt?'overdue':plan.dueAt-asOf<=warningMs?'due_soon':'pending';
   items.push({caseId:c.caseId,stage,status,dueAt:plan.dueAt,completedAt,policyRef:plan.policyRef,basisRef:plan.basisRef});
  }
 }
 const attention=items.filter(x=>['needs_deadline_review','overdue','due_soon','completed_late'].includes(x.status));
 return {mode:'sandbox',asOf,items,attention,caseCount:cases.length};
}
module.exports={reviewCaseDeadlines};
