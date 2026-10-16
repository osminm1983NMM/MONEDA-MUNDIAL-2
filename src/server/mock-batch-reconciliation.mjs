// Laboratorio de Moneda Mundial: conciliación cruzada de remesas ficticias.
// Sólo compara fixtures manuales. No consulta bancos, saldos, proveedores, PII
// ni registros verificados. NUNCA produce autorizaciones ni asientos contables.
import {reconcileMockTransfer} from './mock-transfer-reconciliation.mjs';

const BATCH_ID=/^[A-Za-z0-9_-]{12,90}$/;
const fields=['caseId','order','proposals','statementRows','statementId'];
const own=Object.hasOwn;
const freeze=Object.freeze;
const fail=msg=>{throw new Error(msg)};

export function reconcileMockBatch({batchId,cases}={}){
 if(typeof batchId!=='string'||!BATCH_ID.test(batchId)||
    !Array.isArray(cases)||cases.length>30)
   fail('Lote de conciliación ficticia inválido');
 // El lote falla cerrado si cualquier fixture intenta alterar el contrato.
 const casesRead=cases.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||
    Object.keys(item).length!==fields.length||
    !fields.every(name=>own(item,name))||
    typeof item.caseId!=='string'||!BATCH_ID.test(item.caseId))
   fail('Caso de conciliación ficticia inválido');
  const result=reconcileMockTransfer({
   order:item.order,proposals:item.proposals,statementRows:item.statementRows,
   statementId:item.statementId
  });
  return {caseId:item.caseId,orderId:result.orderId,statementId:result.statementId,
   destination:item.order.destination,result,refs:item.statementRows.map(row=>row.reference)};
 });
 const conflicts=new Map();
 function addConflict(key,caseIndex){
  if(!conflicts.has(key))conflicts.set(key,new Set());
  conflicts.get(key).add(caseIndex);
 }
 for(let i=0;i<casesRead.length;i++){
  const item=casesRead[i];
  addConflict('case:'+item.caseId,i);
  addConflict('order:'+item.orderId,i);
  addConflict('statement:'+item.statementId,i);
  for(const reference of new Set(item.refs))
    addConflict('reference:'+reference,i);
 }
 const reasons=casesRead.map(()=>new Set());
 for(const [key,indices] of conflicts){
  if(indices.size<=1)continue;
  const issue=key.startsWith('case:')?'duplicate_case_id':
    key.startsWith('order:')?'duplicate_order_in_batch':
    key.startsWith('statement:')?'duplicate_statement_id':
    'reference_reused_across_cases';
  for(const index of indices)reasons[index].add(issue);
 }
 const results=casesRead.map((row,i)=>{
  const issues=[...row.result.issues,...reasons[i]].sort();
  const status=issues.length?'manual_review_mock':row.result.status;
  return freeze({
   caseId:row.caseId,orderId:row.orderId,destination:row.destination,
   statementId:row.statementId,status,
   issues:freeze(issues),
   expectedEvents:row.result.expectedEvents,
   receivedEvents:row.result.receivedEvents,
   requiresHumanReview:issues.length>0,
   // Confirmaciones ficticias NO avalan un banco ni el ledger real.
   realPaymentsEnabled:false,bankConnected:false,
   realLedgerPosted:false,eligibleForRealPayout:false,
   canApprove:false,canDisburse:false
  });
 });
 return freeze({
  batchId,environment:'mock_only',source:'manual_unverified_fixtures',
  totalCases:results.length,
  matchedFictionalFixtures:results.filter(x=>x.status==='matched_mock').length,
  pendingCases:results.filter(x=>x.status==='pending_mock').length,
  manualReviewCases:results.filter(x=>x.requiresHumanReview).length,
  cases:freeze(results),
  humanApprovalRequiredForAnyFutureRealTransfer:true,
  realBankStatementsVerified:false,realPaymentsEnabled:false,
  realLedgerPosted:false,canAutoSettle:false,canDisburse:false
 });
}
