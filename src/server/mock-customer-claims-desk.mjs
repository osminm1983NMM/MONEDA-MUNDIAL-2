// MONEDA MUNDIAL 2.0: mesa de incidentes del cliente, SOLO LABORATORIO.
// Registra alegaciones sin confirmar cargos, saldos o reembolsos reales.
// En memoria: NO usar como API pública, servicio de atención real o almacén persistente.
import {randomUUID} from 'node:crypto';

const REQUEST=/^[A-Za-z0-9_-]{12,90}$/;
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const REASONS=new Set([
  'reported_duplicate_charge',
  'reported_missing_payout',
  'reported_missing_refund',
  'reported_incorrect_amount',
]);
const STATES=new Set([
  'created_mock','funded_mock','payout_pending_mock','payout_failed_mock',
  'refund_pending_mock','refund_failed_mock','paid_mock','refunded_mock',
  'cancelled_mock',
]);
const error=(message)=>{throw new Error(message);};

export function createMockCustomerClaimsDesk({lifecycle,clock=()=>Date.now()}={}){
  if(!lifecycle||lifecycle.mode!=='mock'||lifecycle.canMoveRealMoney!==false||
    typeof lifecycle.inspectMockOrder!=='function'||
    typeof lifecycle.getAuditLog!=='function'||typeof clock!=='function')
    error('Mesa de incidentes disponible sólo para simulación');
  const claims=new Map(),byRequest=new Map(),bySubject=new Map(),audit=[];

  function inspectOrder(orderId){
    if(typeof orderId!=='string'||!UUID.test(orderId))error('Referencia de orden inválida');
    const order=lifecycle.inspectMockOrder(orderId);
    if(!order||order.orderId!==orderId||order.environment!=='mock_only'||
      order.realMoneyEnabled!==false||order.fundingRealConfirmed!==false||
      order.payoutRealConfirmed!==false||order.refundRealConfirmed!==false||
      !STATES.has(order.status))
      error('No se puede verificar orden exclusivamente DEMO');
    return order;
  }
  function validateRequest(requestId){
    if(typeof requestId!=='string'||!REQUEST.test(requestId))
      error('Identificador de solicitud inválido');
  }
  function view(caseId,alreadyProcessed=false){
    const c=claims.get(caseId);
    if(!c)error('Caso de prueba inexistente');
    const order=inspectOrder(c.orderId);
    const events=lifecycle.getAuditLog();
    if(!Array.isArray(events))error('Auditoría de simulación no disponible');
    const refundFailures=events.filter(e=>e&&e.orderId===c.orderId&&
      e.type==='refund_failed_mock').length;
    let nextStep='verify_provider_evidence_manually_mock';
    if(order.status==='refund_failed_mock')
      nextStep=refundFailures>=2?
        'escalate_repeated_refund_failures_mock':'investigate_refund_failure_mock';
    else if(order.status==='payout_failed_mock')
      nextStep='investigate_payout_failure_mock';
    else if(order.status==='paid_mock'||order.status==='refunded_mock')
      nextStep='compare_simulated_receipt_with_external_evidence_mock';
    else if(order.status==='cancelled_mock')
      nextStep='investigate_reported_charge_on_cancelled_order_mock';
    return Object.freeze({
      caseId:c.caseId,orderId:c.orderId,reason:c.reason,
      caseStatus:'awaiting_manual_review_mock',
      mockOrderStatus:order.status,refundFailuresObserved:refundFailures,
      followUp:nextStep,createdAtMs:c.createdAtMs,alreadyProcessed,
      allegedChargeVerified:false,bankFundsVerified:false,
      customerRefundVerified:false,customerPayoutVerified:false,
      canAutoRefund:false,canAutoPayout:false,realMoneyEnabled:false,
      confidentialCustomerDataStored:false,
    });
  }
  return Object.freeze({
    mode:'mock_only',realMoneyEnabled:false,persistentStorageConnected:false,
    reportMockClaim({requestId,orderId,reason}={}){
      validateRequest(requestId);
      inspectOrder(orderId);
      if(!REASONS.has(reason))error('Motivo de incidente de prueba inválido');
      const previous=byRequest.get(requestId);
      if(previous){
        if(previous.orderId!==orderId||previous.reason!==reason)
          error('Solicitud repetida con datos distintos');
        return view(previous.caseId,true);
      }
      const subject=orderId+':'+reason;
      let existing=bySubject.get(subject),alreadyProcessed=false;
      if(existing){
        alreadyProcessed=true;
      }else{
        const timestamp=clock();
        if(!Number.isSafeInteger(timestamp)||timestamp<0)error('Reloj inválido');
        existing=randomUUID();
        const incident=Object.freeze({caseId:existing,orderId,reason,createdAtMs:timestamp});
        claims.set(existing,incident);
        bySubject.set(subject,existing);
        audit.push(Object.freeze({type:'mock_claim_opened',caseId:existing,orderId,reason}));
      }
      byRequest.set(requestId,{caseId:existing,orderId,reason});
      return view(existing,alreadyProcessed);
    },
    inspectMockClaim(caseId){
      if(typeof caseId!=='string'||!UUID.test(caseId))error('Identificador de caso inválido');
      return view(caseId);
    },
    listMockClaims(){
      return Object.freeze([...claims.keys()].map(id=>view(id)));
    },
    getMockClaimAudit(){
      return Object.freeze(audit.map(row=>Object.freeze({...row})));
    },
  });
}
