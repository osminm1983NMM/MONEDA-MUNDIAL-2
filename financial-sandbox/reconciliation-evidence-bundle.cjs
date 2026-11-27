'use strict';
// Normalized synthetic evidence only: not original provider bytes or authorization.
const {assembleStatementPages}=require('./statement-pages.cjs');
const {reconcilePagedCut}=require('./reconcile-paged-cut.cjs');
const FORMAT='synthetic-reconciliation-bundle-v1';
const EVIDENCE='synthetic-content-sha256-v1';
const fail=code=>{throw Object.assign(Error(code),{code});};
function canonicalPages(environment,pages,side){
 const s=assembleStatementPages({environment,pages});
 if(s.source!==side)fail('INVALID_SOURCE');
 const {rows,complete,...header}=s;
 const sorted=[...rows].sort((a,b)=>a.reference<b.reference?-1:a.reference>b.reference?1:0);
 const pageCount=Math.max(1,Math.ceil(sorted.length/10000));
 return Array.from({length:pageCount},(_,index)=>({...header,pageCount,index,
  cursor:index===0?null:'page-'+index,
  nextCursor:index===pageCount-1?null:'page-'+(index+1),
  complete:index===pageCount-1,rows:sorted.slice(index*10000,(index+1)*10000)}));
}
function summarize(result){
 return {...result,matchedConfirmedNetMinor:result.clean?result.matchedConfirmedNetMinor:null};
}
function createReconciliationBundle({environment,internalPages,providerPages}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 const bundle={format:FORMAT,internalPages:canonicalPages(environment,internalPages,'internal'),
  providerPages:canonicalPages(environment,providerPages,'provider')};
 const result=reconcilePagedCut({environment,...bundle});
 if(!result.evidence)fail('INVALID_BUNDLE');
 return {bundle,result:summarize(result)};
}
function verifyReconciliationBundle({environment,bundle,expectedEvidence}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!bundle||bundle.format!==FORMAT)fail('INVALID_BUNDLE');
 // Expected evidence must be independently retained (for example, in an archive
 // receipt). Evidence received alongside the bundle is not a trusted anchor.
 if(expectedEvidence?.format!==EVIDENCE||!['internal','provider'].every(side=>
  expectedEvidence[side]?.source===side&&typeof expectedEvidence[side].sha256==='string'&&
  /^[a-f0-9]{64}$/.test(expectedEvidence[side].sha256)))fail('INVALID_EXPECTED_EVIDENCE');
 const {result}=createReconciliationBundle({environment,internalPages:bundle.internalPages,
  providerPages:bundle.providerPages});
 for(const side of ['internal','provider']){
  const actual=result.evidence[side],expected=expectedEvidence[side];
  if(!['source','snapshotId','start','end','capturedAt','declaredCount','sha256'].every(k=>
   actual[k]===expected[k]))fail('EVIDENCE_MISMATCH');
 }
 return summarize(result);
}
module.exports={createReconciliationBundle,verifyReconciliationBundle};
