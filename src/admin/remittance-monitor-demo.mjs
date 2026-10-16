// Información de supervisión interna ficticia. Ningún estado autoriza pagos.
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const c=/^[A-Z]{2}$/;
const states=new Set(['draft','review','simulated','cancelled']);
const picks=new Set(['not_issued','active','cancelled','expired','locked','consumed']);
const assignments=new Set(['unassigned','planned','sample_completed']);
export function summarizeRemittanceMonitor(data=[]){
 if(!Array.isArray(data))throw Error('Respuesta no válida');
 const rows=data.map(x=>{
  if(!x||!uuid.test(x.order_id||'')||!c.test(x.source_country||'')||
     !c.test(x.destination_country||'')||
     !Number.isSafeInteger(x.amount_cents)||x.amount_cents<100||
     x.amount_cents>10000000||!states.has(x.order_status)||
     !picks.has(x.pickup_status)||!assignments.has(x.assignment_status)||
     !Number.isSafeInteger(x.event_count)||x.event_count<0||
     !Number.isSafeInteger(x.failed_attempts)||x.failed_attempts<0||x.failed_attempts>5||
     !Number.isSafeInteger(x.anomaly_count)||x.anomaly_count<0||
     !['normal','expired','review'].includes(x.attention)||
     x.real_payments_enabled!==false)throw Error('Registro de monitor inválido');
  return Object.freeze({
   id:x.order_id,country:x.destination_country,source:x.source_country,
   amountCents:x.amount_cents,status:x.order_status,events:x.event_count,
   assignment:x.assignment_status,pickup:x.pickup_status,
   failures:x.failed_attempts,attention:x.attention,
   anomalyCount:x.anomaly_count,identityMockChecked:x.identity_demo_checked===true,
   realPaymentsEnabled:false,canPay:false
  });
 });
 return Object.freeze({total:rows.length,needsReview:rows.filter(x=>x.attention==='review').length,
  expired:rows.filter(x=>x.pickup==='expired').length,
  cancelled:rows.filter(x=>x.status==='cancelled').length,
  rows:Object.freeze(rows),realPaymentsEnabled:false,canPay:false});
}
