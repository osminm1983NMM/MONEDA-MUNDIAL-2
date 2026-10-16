// Moneda Mundial 2.0: bitácora de DOBLE REVISIÓN FICTICIA, sólo servidor Node.
// Encadenamiento SHA-256 didáctico y SOLO EN RAM. No es un registro forense
// inmutable ni sustituye almacenamiento WORM, auditoría externa o permisos reales.
// Nunca almacenar tokens de sesión, contraseñas, documentos, claves o importes.
import {createHash} from 'node:crypto';

const EVENTS=new Set([
 'review_created_mock','second_review_recorded_mock',
 'review_expired_mock','review_initiator_revoked_mock',
 'self_review_rejected_mock','cross_institution_rejected_mock',
]);
const REVIEW_ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const CASE=/^SIM-(HN|NI)-[0-9]{3}$/;
const IDENTIFIER=/^[A-Za-z0-9_-]{8,72}$/;
const ACTIONS=new Set(['bank_payout','refund_approval','cash_pickup_release',
 'staff_membership_change','crypto_exchange']);
const sha=s=>createHash('sha256').update(s).digest('hex');
const GENESIS='0'.repeat(64);
const fail=msg=>{throw Error(msg)};
const fields=['seq','atMs','kind','reviewId','caseId','institutionId','actorId','action','status'];
function publicPayload(x){
 return Object.fromEntries(fields.map(k=>[k,x[k]]));
}
function validate(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||
  !EVENTS.has(e.kind)||!REVIEW_ID.test(e.reviewId||'')||
  !CASE.test(e.caseId||'')||!['bank-hn','bank-ni','agent-hn','agent-ni'].includes(e.institutionId)||
  !(e.actorId===null||IDENTIFIER.test(e.actorId||''))||
  !ACTIONS.has(e.action)||typeof e.status!=='string'||
  !['pending_mock','dual_review_recorded_mock','expired_mock',
   'void_member_revoked_mock'].includes(e.status)||
  !Number.isSafeInteger(e.seq)||e.seq<1||
  !Number.isSafeInteger(e.atMs)||e.atMs<0)
   fail('Evento de auditoría de laboratorio inválido');
}
function fullFields(e){
 return e&&typeof e==='object'&&!Array.isArray(e)&&
  Object.keys(e).sort().join(',')===[...fields,'previousHash','hash'].sort().join(',');
}
export function createMockDualReviewAudit({clock=()=>Date.now()}={}){
 if(typeof clock!=='function')fail('Reloj inválido');
 const entries=[];let tip=GENESIS;
 return Object.freeze({
  append({kind,reviewId,caseId,institutionId,actorId=null,action,status}={}){
   const atMs=clock(),seq=entries.length+1;
   const payload={seq,atMs,kind,reviewId,caseId,institutionId,actorId,action,status};
   validate(payload);
   const hash=sha(tip+JSON.stringify(payload));
   const entry=Object.freeze({...payload,previousHash:tip,hash});
   entries.push(entry);tip=hash;
   return Object.freeze({...entry});
  },
  // Snapshot para comprobar integridad en tests de CI. No exportar en API pública.
  testSnapshot(){return Object.freeze(entries.map(x=>Object.freeze({...x})));},
  verifyTestSnapshot(snapshot=entries){
   if(!Array.isArray(snapshot)||snapshot.length!==entries.length)return false;
   let previous=GENESIS;
   for(let i=0;i<snapshot.length;i++){
    const e=snapshot[i];
    if(!fullFields(e)||e.seq!==i+1||e.previousHash!==previous)return false;
    try{validate(e)}catch{return false}
    const hash=sha(previous+JSON.stringify(publicPayload(e)));
    if(e.hash!==hash)return false;
    previous=hash;
   }
   return previous===tip;
  },
  getSummary(){
   return Object.freeze({eventCount:entries.length,chainTip:tip,
    integrityValid:this.verifyTestSnapshot(),realAuditEnabled:false,
    externallyAnchored:false,bankEvidenceVerified:false,
    productionMoneyEnabled:false});
  },
 });
}
