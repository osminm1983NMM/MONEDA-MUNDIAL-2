import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockDualReview} from '../src/server/mock-dual-review.mjs';
const keys=generateKeyPairSync('ed25519');
const pem=keys.publicKey.export({format:'pem',type:'spki'});
let time=1700000000000;
function demo(){
 time=1700000000000;
 const gateway=createMockInstitutionSessionGateway({clock:()=>time,members:[
  ...['reviewer-hn-a','reviewer-hn-b'].map(memberId=>({memberId,institutionId:'bank-hn',state:'active_mock',publicKeyPem:pem})),
  {memberId:'reviewer-ni-a',institutionId:'bank-ni',state:'active_mock',publicKeyPem:pem},
 ]});
 const login=(memberId)=>{
  const c=gateway.beginMockChallenge({memberId});
  return gateway.completeMockChallenge({challengeId:c.challengeId,memberId,
   signatureBase64url:sign(null,Buffer.from(c.signedMessage),keys.privateKey).toString('base64url')}).sessionToken;
 };
 return {gateway,review:createMockDualReview({sessionGateway:gateway,clock:()=>time}),login};
}
test('registra creación, denegaciones y segunda revisión ficticia con SHA256 íntegro',()=>{
 const {review,login}=demo(),a=login('reviewer-hn-a'),b=login('reviewer-hn-b'),ni=login('reviewer-ni-a');
 const q=review.beginReview({sessionToken:a,caseId:'SIM-HN-001',action:'cash_pickup_release'});
 assert.throws(()=>review.secondReview({sessionToken:a,reviewId:q.reviewId}),/autoaprobar/);
 assert.throws(()=>review.secondReview({sessionToken:ni,reviewId:q.reviewId}),/otra institución/);
 review.secondReview({sessionToken:b,reviewId:q.reviewId});
 const entries=review.auditTestSnapshot();
 assert.deepEqual(entries.map(x=>x.kind),[
  'review_created_mock','self_review_rejected_mock','cross_institution_rejected_mock','second_review_recorded_mock']);
 assert.equal(review.verifyAuditTestSnapshot(entries),true);
 assert.equal(review.auditSummary().eventCount,4);
 assert.equal(review.auditSummary().realAuditEnabled,false);
 assert.equal(review.auditSummary().integrityValid,true);
 assert.equal(review.verifyAuditTestSnapshot(entries.map((x,i)=>i===1?{...x,actorId:'attacker-ni'}:x)),false);
 assert.equal(review.verifyAuditTestSnapshot(entries.slice(1)),false);
});
test('registra expiración una sola vez e invalida revisión revocada',()=>{
 const {gateway,review,login}=demo(),a=login('reviewer-hn-a');
 const q=review.beginReview({sessionToken:a,caseId:'SIM-HN-001',action:'bank_payout'});
 time+=300000;review.inspectReview(q.reviewId);review.inspectReview(q.reviewId);
 assert.equal(review.auditTestSnapshot().filter(x=>x.kind==='review_expired_mock').length,1);
 time=1700000000000;
 const p=review.beginReview({sessionToken:a,caseId:'SIM-HN-002',action:'bank_payout'});
 gateway.simulateAdminMembershipRevocation('reviewer-hn-a');
 review.inspectReview(p.reviewId);
 assert.equal(review.auditTestSnapshot().filter(x=>x.kind==='review_initiator_revoked_mock').length,1);
 assert.equal(review.auditSummary().integrityValid,true);
});
