// Reglas de atención al cliente SOLO para estados de pruebas en memoria.
// El estado NEVER permite desembolso, devolución real o saldo monetario.
const choices=Object.freeze({
 created_mock:['cancel_unfunded_mock','La orden ficticia no está financiada; se puede cerrar sin devolución.',false],
 funded_mock:['request_refund_mock','Existe solo un estado de fondeo simulado. Solicitar reembolso de prueba.',false],
 payout_pending_mock:['manual_review_mock','La salida está pendiente. No prometer devolución hasta resolver resultado ficticio.',true],
 payout_failed_mock:['request_refund_mock','Salida ficticia fallida. Permite iniciar devolución de prueba.',false],
 refund_pending_mock:['await_refund_confirmation_mock','Esperar confirmación firmada de prueba; no acreditar saldos.',true],
 refund_failed_mock:['manual_review_refund_failure_mock','Devolución ficticia fallida; necesita investigación humana.',true],
 paid_mock:['dispute_manual_review_mock','Marcada pagada solo en laboratorio. No cancelar ni reembolsar automáticamente.',true],
 refunded_mock:['closed_refunded_mock','Devolución ficticia cerrada. No repetir devolución.',false],
 cancelled_mock:['closed_unfunded_mock','Cancelada antes del fondeo de prueba; nunca se produjo pago.',false],
});
export const DEMO_REFUND_STATES=Object.freeze(Object.keys(choices));
export function assessMockRefundCancellation(status){
 if(typeof status!=='string'||!Object.hasOwn(choices,status))
  throw Error('Estado de pago ficticio desconocido');
 const [nextAction,explanation,humanReviewNeeded]=choices[status];
 return Object.freeze({
  status,nextAction,explanation,humanReviewNeeded,
  canCancelUnfundedDemo:status==='created_mock',
  canRequestRefundDemo:['funded_mock','payout_failed_mock'].includes(status),
  // Una solicitud puede ser pendiente; nunca confirmar dinero sin liquidación.
  actualRefundConfirmed:false,actualBankPaymentConfirmed:false,
  realMoneyEnabled:false,canPostLedger:false,canApproveRealRefund:false,
  canSendRealMoney:false,
 });
}
