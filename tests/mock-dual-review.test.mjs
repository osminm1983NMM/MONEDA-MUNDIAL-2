import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockDualReview} from '../src/server/mock-dual-review.mjs';
const pair=generateKeyPairSync('ed25519'),pem=pair.publicKey.export({format:'pem',type:'spki'});
let now=1700000000000;
function setup(){
 now=1700000000000;
 const gateway=createMockInstitutionSessionGateway({clock:()=>now,members:[
  ...['staff-hn-001','staff-hn-002'].map(memberId=>({memberId,institutionId:'bank-hn',state:'active_mock',publicKeyPem:pem})),
  {memberId:'staff-ni-001',institutionId:'bank-ni',state:'active_mock',publicKeyPem:pem},
 ]});
 const login=memberId=>{
  const q=gateway.beginMockChallenge({memberId});
  return gateway.completeMockChallenge({challengeId:q.challengeId,memberId,
   signatureBase64url:sign(null,Buffer.from(q.signedMessage),pair.privateKey).toString('base64url')}).sessionToken;
 };
 return {gateway,review:createMockDualReview({sessionGateway:gateway,clock:()=>now}),login};
}
test('dos personas distintas registran revisión; jamás ejecutan desembolso',()=>{
 const {review,login}=setup(),first=login('staff-hn-001'),second=login('staff-hn-002');
 const request=review.beginReview({sessionToken:first,caseId:'SIM-HN-001',action:'bank_payout'});
 assert.equal(request.canExecute,false);
 assert.throws(()=>review.secondReview({sessionToken:first,reviewId:request.reviewId}),/autoaprobar/);
 const done=review.secondReview({sessionToken:second,reviewId:request.reviewId});
 assert.equal(done.status,'dual_review_recorded_mock');
 assert.equal(done.approvedForProduction,false);
 assert.throws(()=>review.secondReview({sessionToken:second,reviewId:request.reviewId}),/terminada/);
});
test('ni empleados de otras entidades ni casos ajenos pueden confirmar',()=>{
 const {review,login}=setup(),first=login('staff-hn-001'),other=login('staff-ni-001');
 const q=review.beginReview({sessionToken:first,caseId:'SIM-HN-001',action:'refund_approval'});
 assert.throws(()=>review.secondReview({sessionToken:other,reviewId:q.reviewId}),/otra institución/);
 assert.throws(()=>review.beginReview({sessionToken:other,caseId:'SIM-HN-001',action:'refund_approval'}),/inválida/);
});
test('el vencimiento y la revocación invalidan solicitudes de revisión',()=>{
 const {review,login,gateway}=setup();
 const first=login('staff-hn-001'),second=login('staff-hn-002');
 const q=review.beginReview({sessionToken:first,caseId:'SIM-HN-001',action:'cash_pickup_release'});
 now+=300000;
 assert.equal(review.inspectReview(q.reviewId).status,'expired_mock');
 assert.throws(()=>review.secondReview({sessionToken:second,reviewId:q.reviewId}),/terminada/);
 now=1700000000000;
 const k=review.beginReview({sessionToken:first,caseId:'SIM-HN-002',action:'bank_payout'});
 gateway.simulateAdminMembershipRevocation('staff-hn-001');
 assert.equal(review.inspectReview(k.reviewId).status,'void_member_revoked_mock');
 assert.throws(()=>review.secondReview({sessionToken:second,reviewId:k.reviewId}),/terminada/);
});
