'use strict';
// Synthetic reconciliation with reproducible content evidence, not authenticated
// provider proof. No network, database writes, authorization or settlement.
const {createHash}=require('node:crypto');
const {assembleStatementPages}=require('./statement-pages.cjs');
const {reconcileCut}=require('./reconcile-cut.cjs');
function evidence(s){
 const sorted=[...s.rows].sort((a,b)=>a.reference<b.reference?-1:a.reference>b.reference?1:0);
 const canonical=[s.mode,s.source,s.snapshotId,s.scope,s.start,s.end,s.capturedAt,s.declaredCount,
  sorted.map(r=>[r.reference,r.kind,r.currency,r.amountMinor,r.status])];
 return {source:s.source,snapshotId:s.snapshotId,start:s.start,end:s.end,
  capturedAt:s.capturedAt,declaredCount:s.declaredCount,
  sha256:createHash('sha256').update(JSON.stringify(canonical)).digest('hex')};
}
function reconcilePagedCut({environment,internalPages,providerPages}={}){
 if(environment!=='sandbox')throw Error('SANDBOX_ONLY');
 const snapshots={},issues=[];
 for(const [side,pages] of [['internal',internalPages],['provider',providerPages]]){
  try {
   const s=assembleStatementPages({environment,pages});
   if(s.source!==side){issues.push({code:'INVALID_SOURCE',side});continue;}
   snapshots[side]=s;
  } catch(e){
   if(typeof e?.code!=='string')throw e;
   issues.push({code:e.code,side});
  }
 }
 if(issues.length)return {mode:'sandbox',clean:false,issues,matchedConfirmedNetMinor:null,evidence:null};
 return {...reconcileCut({environment,...snapshots}),evidence:{
  format:'synthetic-content-sha256-v1',internal:evidence(snapshots.internal),provider:evidence(snapshots.provider)
 }};
}
module.exports={reconcilePagedCut};
