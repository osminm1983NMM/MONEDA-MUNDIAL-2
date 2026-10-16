// MONEDA MUNDIAL: doble revisión de alto riesgo EN LABORATORIO.
// Dos empleados diferentes de la misma institución deben confirmar revisión
// de un caso ficticio. NUNCA permite pago, reembolso, retiro o crypto.
import {randomUUID} from 'node:crypto';
const ACTIONS=new Set(['bank_payout','refund_approval','cash_pickup_release',
 'staff_membership_change','crypto_exchange']);
const CASE=/^SIM-(HN|NI)-[0-9]{3}$/;
const fail=m=>{throw Error(m)};
const copy=o=>Object.freeze({...o,realMoneyEnabled:false,canExecute:false,
 realMfaVerified:false,approvedForProduction:false});
export function createMockDualReview({sessionGateway,clock=()=>Date.now()}={}){
 if(!sessionGateway||sessionGateway.mode!=='mock'||
    typeof sessionGateway.authorizeMockSession!=='function'||
    typeof sessionGateway.isMockMemberActiveForReview!=='function')
   fail('Requiere sesión de laboratorio');
 const records=new Map();
 const now=()=>{const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('Reloj inválido');return t;};
 const check=(token)=>sessionGateway.authorizeMockSession({sessionToken:token,action:'request_mock_review'});
 const response=(q)=>copy({reviewId:q.id,status:q.status,
   institutionId:q.institutionId,caseId:q.caseId,
   action:q.action,firstReviewer:q.initiator,secondReviewer:q.reviewer||null,
   expiresAt:q.expiresAt,recordedAsDemoOnly:true});
 function refresh(q){
  if(q.status==='pending_mock'&&now()>=q.expiresAt)q.status='expired_mock';
  if(q.status==='pending_mock'&&!sessionGateway.isMockMemberActiveForReview({
     memberId:q.initiator,institutionId:q.institutionId}))q.status='void_member_revoked_mock';
 }
 return Object.freeze({
  mode:'mock',canExecuteRealTransactions:false,
  beginReview({sessionToken,caseId,action}={}){
   const auth=check(sessionToken);
   if(!auth.allowed)fail('Iniciador no autorizado en laboratorio');
   if(!CASE.test(caseId)||caseId.slice(4,6)!==auth.country||
      !ACTIONS.has(action))fail('Caso o acción de revisión ficticia inválida');
   const id=randomUUID(),q={id,initiator:auth.memberId,institutionId:auth.institutionId,
    country:auth.country,caseId,action,status:'pending_mock',expiresAt:now()+300000};
   records.set(id,q);return response(q);
  },
  secondReview({sessionToken,reviewId}={}){
   const auth=check(sessionToken);
   if(!auth.allowed)fail('Revisor no autorizado en laboratorio');
   const q=records.get(reviewId);
   if(!q)fail('Solicitud de revisión inexistente');
   refresh(q);
   if(q.status!=='pending_mock')fail('Revisión ya terminada o caducada');
   if(auth.institutionId!==q.institutionId||auth.country!==q.country)
     fail('Revisor de otra institución');
   if(auth.memberId===q.initiator)fail('No se permite autoaprobar revisión');
   q.reviewer=auth.memberId;q.status='dual_review_recorded_mock';
   return response(q);
  },
  inspectReview(reviewId){
   const q=records.get(reviewId);if(!q)return null;
   refresh(q);return response(q);
  },
 });
}
