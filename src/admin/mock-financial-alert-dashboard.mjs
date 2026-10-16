// Datos enteramente inventados para un panel informativo de pruebas.
// NO prueba roles de producción, no consulta cuentas, no permite mover fondos.
import {evaluateMockOperationRisk} from '../server/mock-risk-monitor.mjs';

const scope=Object.freeze({
 'bank-hn':Object.freeze({role:'bank',country:'HN'}),
 'bank-ni':Object.freeze({role:'bank',country:'NI'}),
 'agent-hn':Object.freeze({role:'agent',country:'HN'}),
 'agent-ni':Object.freeze({role:'agent',country:'NI'}),
});
const samples=Object.freeze([
 {id:'SIM-HN-001',country:'HN',amountCents:10000,bank:'bank-hn',agent:'agent-hn',
  orderStatus:'payout_pending_mock',duplicateEventCount:2,minutesPending:1500},
 {id:'SIM-HN-002',country:'HN',amountCents:85000,bank:'bank-hn',agent:'agent-hn',
  orderStatus:'payout_failed_mock',unmatchedStatementCount:1},
 {id:'SIM-NI-001',country:'NI',amountCents:10000,bank:'bank-ni',agent:'agent-ni',
  orderStatus:'refund_pending_mock',refundAttempts:4},
 {id:'SIM-NI-002',country:'NI',amountCents:2500,bank:'bank-ni',agent:'agent-ni',
  orderStatus:'funded_mock'},
]);
export const DEMO_ALERT_SCOPES=scope;
export function projectMockAlerts({role,entityId=null}={}){
 if(!['owner','bank','agent'].includes(role))throw Error('Vista DEMO inválida');
 const s=role==='owner'&&entityId===null?{role:'owner'}:scope[entityId];
 if(!s||s.role!==role)return Object.freeze({allowed:false,alerts:Object.freeze([]),total:0,flagged:0});
 const alerts=samples.filter(x=>role==='owner'||x[role]===entityId)
  .map(item=>{
   const r=evaluateMockOperationRisk(item);
   const a={id:item.id,country:item.country,needsReview:r.humanReviewRequired,
    summary:r.humanReviewRequired?'Revisión humana (ejemplo)':'Sin señales detectadas en el ejemplo',
    canPay:false,realMoney:false};
   if(role!=='agent'){a.amountCents=item.amountCents;a.signals=Object.freeze([...r.signals]);}
   return Object.freeze(a);
  });
 return Object.freeze({allowed:true,role,alerts:Object.freeze(alerts),total:alerts.length,
  flagged:alerts.filter(x=>x.needsReview).length,
  canPay:false,canApprove:false,realMoneyEnabled:false,source:'static_fictional_examples'});
}
