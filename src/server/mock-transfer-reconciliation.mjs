// MWD 2.0: conciliación de transacciones y reembolsos EXCLUSIVAMENTE MOCK.
// No consulta proveedores, no confirma dinero y nunca contabiliza fondos.
import {createHash} from 'node:crypto';
const P=['funding_settled_mock','payout_settled_mock','refund_settled_mock'];
const STATES=['created_mock','funded_mock','payout_pending_mock','payout_failed_mock',
 'refund_pending_mock','refund_failed_mock','paid_mock','refunded_mock'];
const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ID=/^[a-zA-Z0-9_-]{12,90}$/;
const sha=x=>createHash('sha256').update(x).digest('hex');
const bad=m=>{throw new Error(m)};
const keys=(v,allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).every(x=>allowed.includes(x));
const orderKeys=['orderId','destination','currency','amountCents','status','alreadyProcessed',
 'environment','fundingRealConfirmed','payoutRealConfirmed','refundRealConfirmed',
 'realMoneyEnabled','ledgerAutomaticallyPosted'];
const proposalKeys=['eventType','reference','currency','verifiedBankFunds','realPayment',
 'recordedInLedger','providerReferenceAuthentic','canPostToLiveLedger','lines'];
const safe=m=>Object.freeze(m);
const ref=(orderId,phase)=>'DEMO_'+orderId.replaceAll('-','')+'_'+phase;
function orderOk(o){
 if(!keys(o,orderKeys)||!UUID.test(o.orderId||'')||
 !['HN','NI'].includes(o.destination)||o.currency!=='USD'||
 !Number.isSafeInteger(o.amountCents)||o.amountCents<100||o.amountCents>10000000||
 !STATES.includes(o.status)||o.environment!=='mock_only'||o.realMoneyEnabled!==false||
 o.ledgerAutomaticallyPosted!==false||o.fundingRealConfirmed!==false||
 o.payoutRealConfirmed!==false||o.refundRealConfirmed!==false)
 bad('Orden de prueba inválida');
}
function expected(status){
 if(status==='created_mock')return [];
 if(status==='paid_mock')return [P[0],P[1]];
 if(status==='refunded_mock')return [P[0],P[2]];
 return [P[0]];
}
function checkProposal(p,order){
 if(!keys(p,proposalKeys)||!P.includes(p.eventType)||
 p.reference!==ref(order.orderId,p.eventType)||p.currency!=='USD'||
 p.verifiedBankFunds!==false||p.realPayment!==false||
 p.recordedInLedger!==false||p.providerReferenceAuthentic!==false||
 p.canPostToLiveLedger!==false||!Array.isArray(p.lines)||p.lines.length!==2)
 bad('Propuesta de contabilidad ficticia inválida');
 const sides=p.eventType===P[0]
 ?[['BANK_CLEARING_USD','debit'],['CUSTOMER_PAYABLE_USD','credit']]
 :[['CUSTOMER_PAYABLE_USD','debit'],['BANK_CLEARING_USD','credit']];
 for(let i=0;i<2;i++){
  const l=p.lines[i];
  if(!keys(l,['account','side','amount_minor'])||
   l.account!==sides[i][0]||l.side!==sides[i][1]||
   l.amount_minor!==String(order.amountCents))
   bad('Propuesta desequilibrada o no coincide');
 }
}
function rowOk(v){
 if(!keys(v,['reference','phase','amountCents','currency','source','status'])||
 !/^DEMO_[0-9A-Za-z_]{20,125}$/.test(v.reference||'')||
 !P.includes(v.phase)||!Number.isSafeInteger(v.amountCents)||
 v.amountCents<100||v.amountCents>10000000||v.currency!=='USD'||
 v.source!=='manual_mock_fixture'||v.status!=='settled_mock')
 bad('Extracto de prueba inválido');
}
export function reconcileMockTransfer({order,proposals,statementRows,statementId}={}){
 orderOk(order);
 if(!ID.test(statementId||'')||!Array.isArray(proposals)||proposals.length>3||
 !Array.isArray(statementRows)||statementRows.length>30)
 bad('Argumentos de conciliación ficticia inválidos');
 const phases=expected(order.status), proposed=new Map(),seen=new Map(),issues=[];
 for(const p of proposals){
  checkProposal(p,order);
  if(proposed.has(p.eventType))bad('Propuesta duplicada');
  if(!phases.includes(p.eventType))bad('Propuesta no corresponde con estado de orden');
  proposed.set(p.eventType,p);
 }
 for(const row of statementRows){
  rowOk(row);
  if(seen.has(row.reference))issues.push('duplicate_statement_record');
  else seen.set(row.reference,row);
 }
 for(const phase of phases){
  if(!proposed.has(phase))issues.push('missing_ledger_proposal:'+phase);
  const actual=seen.get(ref(order.orderId,phase));
  if(!actual)issues.push('missing_statement_record:'+phase);
  else if(actual.phase!==phase||actual.amountCents!==order.amountCents)
    issues.push('provider_statement_mismatch:'+phase);
 }
 for(const reference of seen.keys())
  if(!phases.some(p=>ref(order.orderId,p)===reference))
   issues.push('unexpected_statement_record');
 const completed=['paid_mock','refunded_mock'].includes(order.status);
 return safe({statementId,orderId:order.orderId,
  status:issues.length?'manual_review_mock':completed?'matched_mock':'pending_mock',
  mockOrderStatus:order.status,expectedEvents:phases.length,
  receivedEvents:statementRows.length,issues:safe(issues),
  requiresHumanReview:issues.length>0,realMoneyEnabled:false,
  sourceVerified:false,bankConnected:false,realLedgerPosted:false,
  eligibleForAutomaticSettlement:false,eligibleForRealPayout:false});
}

// Cadena SHA256 didáctica, en memoria; NO es registro inmutable/verificado.
export function createMockAuditTrail(){
 let tip='0'.repeat(64);const rows=[],idMap=new Map();
 const shape=e=>{
  if(!keys(e,['eventId','orderId','kind','status'])||
   !ID.test(e.eventId||'')||!UUID.test(e.orderId||'')||
   !['reconciliation_mock','payout_review_mock','refund_review_mock'].includes(e.kind)||
   !['matched_mock','manual_review_mock','pending_mock'].includes(e.status))
    bad('Evento no permitido');
  return {eventId:e.eventId,orderId:e.orderId,kind:e.kind,status:e.status};
 };
 return safe({
  append(event){
   const e=shape(event),fingerprint=sha(JSON.stringify(e));
   if(idMap.has(e.eventId)){
    if(idMap.get(e.eventId)!==fingerprint)bad('Idempotencia de auditoría inválida');
    return safe({...rows.find(x=>x.eventId===e.eventId),alreadyProcessed:true});
   }
   const row=safe({...e,previousHash:tip,hash:sha(tip+JSON.stringify(e))});
   rows.push(row);tip=row.hash;idMap.set(e.eventId,fingerprint);
   return safe({...row,alreadyProcessed:false});
  },
  entries(){return safe(rows.map(row=>safe({...row})));},
  verify(items=rows){
   if(!Array.isArray(items)||items.length!==rows.length)return false;
   let h='0'.repeat(64);
   for(const row of items){
    if(!row||Object.keys(row).sort().join('|')!==
       ['eventId','orderId','kind','status','previousHash','hash'].sort().join('|'))return false;
    let e;
    try{e=shape({eventId:row.eventId,orderId:row.orderId,kind:row.kind,status:row.status})}catch{return false}
    if(row.previousHash!==h||row.hash!==sha(h+JSON.stringify(e)))return false;
    h=row.hash;
   }
   return h===tip;
  },
  realAuditEnabled:false,remoteStorageConnected:false,realMoneyEnabled:false,
 });
}
