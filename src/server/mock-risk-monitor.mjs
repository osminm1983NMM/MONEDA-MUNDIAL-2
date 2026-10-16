// MWD: panel de alertas de simulación. No contiene datos reales, no hace pagos
// ni reportes regulatorios y no decide si una transacción constituye fraude.
// Solamente propone una revisión humana ante diferencias en datos ficticios.
const statuses=new Set(['created_mock','funded_mock','payout_pending_mock',
 'payout_failed_mock','refund_pending_mock','refund_failed_mock','paid_mock','refunded_mock']);
const valid=(v)=>Number.isSafeInteger(v)&&v>=0&&v<=10000000;
const freeze=v=>Object.freeze(v);
export function evaluateMockOperationRisk({orderStatus,amountCents,
  duplicateEventCount=0,unmatchedStatementCount=0,
  minutesPending=0,refundAttempts=0}={}){
 if(!statuses.has(orderStatus)||!valid(amountCents)||amountCents<100||
 !valid(duplicateEventCount)||!valid(unmatchedStatementCount)||
 !valid(minutesPending)||!valid(refundAttempts))
   throw new Error('Indicadores de ensayo inválidos');
 const signals=[];
 if(duplicateEventCount>0)signals.push('repeated_provider_event_mock');
 if(unmatchedStatementCount>0)signals.push('bank_statement_discrepancy_mock');
 if(['payout_pending_mock','refund_pending_mock'].includes(orderStatus)&&
     minutesPending>=1440)signals.push('pending_over_24h_mock');
 if(refundAttempts>=3)signals.push('refund_attempts_review_mock');
 if(orderStatus==='payout_failed_mock')signals.push('failed_payout_review_mock');
 // Un importe alto NO prueba fraude; sólo puede elevar la prioridad de revisión.
 if(amountCents>=500000)signals.push('high_value_review_mock');
 const manualReview=signals.length>0;
 return freeze({
   status:manualReview?'manual_review_mock':'no_signals_in_mock',
   signals:freeze(signals),humanReviewRequired:manualReview,
   automaticallyBlockRealFunds:false,automaticallyApproveRealFunds:false,
   fraudDetermined:false,identityVerified:false,realMoneyEnabled:false,
   sanctionsScreened:false,automatedBankAction:false,
   message:'Solo señales ficticias: personal autorizado decide con evidencia externa.',
 });
}
