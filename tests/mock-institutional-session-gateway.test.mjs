import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({format:'pem',type:'spki'});
let now=1700000000000;
const build=()=>createMockInstitutionSessionGateway({clock:()=>now,members:[
 {memberId:'bank-hn-staff-001',institutionId:'bank-hn',state:'active_mock',publicKeyPem},
 {memberId:'bank-ni-staff-002',institutionId:'bank-ni',state:'pending_mock',publicKeyPem},
]});
const signatureFor=msg=>sign(null,Buffer.from(msg),privateKey).toString('base64url');
test('sesión de prueba exige firma válida y queda limitada a su banco',()=>{
 now=1700000000000;
 const g=build(),c=g.beginMockChallenge({memberId:'bank-hn-staff-001'});
 const s=g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)});
 assert.equal(s.realMoneyEnabled,false);assert.equal(s.realMfaEnabled,false);
 assert.equal(g.inspectMockSession({sessionToken:s.sessionToken,institutionId:'bank-hn',action:'read_mock_cases'}).allowed,true);
 assert.equal(g.inspectMockSession({sessionToken:s.sessionToken,institutionId:'bank-ni',action:'read_mock_cases'}).allowed,false);
 assert.equal(g.inspectMockSession({sessionToken:s.sessionToken,institutionId:'bank-hn',action:'payout'}).allowed,false);
 assert.throws(()=>g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)}),/no encontrado/);
});
test('se bloquea personal pendiente, firmas falsas y tres intentos',()=>{
 now=1700000000000;const g=build();
 assert.throws(()=>g.beginMockChallenge({memberId:'bank-ni-staff-002'}),/no activa/);
 const c=g.beginMockChallenge({memberId:'bank-hn-staff-001'});
 for(let i=0;i<3;i++)assert.throws(()=>g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:'z'.repeat(86)}),/Firma/);
 assert.throws(()=>g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)}),/no encontrado/);
});
test('caducidad, cierre de sesión y revocación impiden continuar',()=>{
 now=1700000000000;const g=build();
 let c=g.beginMockChallenge({memberId:'bank-hn-staff-001'});
 now+=90000;
 assert.throws(()=>g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)}),/vencido/);
 c=g.beginMockChallenge({memberId:'bank-hn-staff-001'});
 const s=g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)});
 assert.equal(g.logoutMockSession({sessionToken:s.sessionToken}).revoked,true);
 assert.equal(g.inspectMockSession({sessionToken:s.sessionToken,institutionId:'bank-hn',action:'read_mock_cases'}).allowed,false);
 c=g.beginMockChallenge({memberId:'bank-hn-staff-001'});
 const s2=g.completeMockChallenge({memberId:'bank-hn-staff-001',challengeId:c.challengeId,signatureBase64url:signatureFor(c.signedMessage)});
 g.simulateAdminMembershipRevocation('bank-hn-staff-001');
 assert.equal(g.inspectMockSession({sessionToken:s2.sessionToken,institutionId:'bank-hn',action:'read_mock_cases'}).allowed,false);
 assert.throws(()=>g.beginMockChallenge({memberId:'bank-hn-staff-001'}),/no activa/);
});
test('no admite modo live ni devuelve claves privadas',()=>{
 now=1700000000000;
 assert.throws(()=>createMockInstitutionSessionGateway({mode:'live',members:[]}),/BLOQUEADO/);
 const g=build();
 assert.equal(g.realAuthentication,false);
 assert.equal(JSON.stringify(g.safeAudit()).includes('PRIVATE KEY'),false);
});
