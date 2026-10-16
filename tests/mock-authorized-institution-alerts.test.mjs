import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createMockInstitutionSessionGateway} from '../src/server/mock-institutional-session-gateway.mjs';
import {createMockInstitutionAuthorizedAlerts} from '../src/server/mock-authorized-institution-alerts.mjs';
let now=1700000000000;
const pair=generateKeyPairSync('ed25519');
const pem=pair.publicKey.export({format:'pem',type:'spki'});
function setup(){
 now=1700000000000;
 const sessionGateway=createMockInstitutionSessionGateway({clock:()=>now,members:[
  {memberId:'bank-hn-staff-001',institutionId:'bank-hn',state:'active_mock',publicKeyPem:pem},
  {memberId:'agent-ni-staff-001',institutionId:'agent-ni',state:'active_mock',publicKeyPem:pem},
 ]});
 const app=createMockInstitutionAuthorizedAlerts({sessionGateway});
 const login=memberId=>{
  const c=sessionGateway.beginMockChallenge({memberId});
  return sessionGateway.completeMockChallenge({memberId,challengeId:c.challengeId,
   signatureBase64url:sign(null,Buffer.from(c.signedMessage),pair.privateKey).toString('base64url')}).sessionToken;
 };
 return {sessionGateway,app,login};
}
test('token de banco HN sólo ve alertas de su entidad sin poder pagar',()=>{
 const {app,login}=setup();
 const d=app.fetchOwnMockAlerts({sessionToken:login('bank-hn-staff-001')});
 assert.equal(d.allowed,true);assert.equal(d.total,2);
 assert.ok(d.alerts.every(a=>a.country==='HN'));
 assert.equal(d.realMoneyEnabled,false);assert.equal(d.canPay,false);
});
test('token de agente NI limita país y elimina importes',()=>{
 const {app,login}=setup();
 const d=app.fetchOwnMockAlerts({sessionToken:login('agent-ni-staff-001')});
 assert.equal(d.total,2);
 assert.ok(d.alerts.every(a=>a.country==='NI'&&!('amountCents' in a)));
});
test('sin token, revocación o caducidad rechaza toda vista',()=>{
 const {app,login,sessionGateway}=setup();
 assert.equal(app.fetchOwnMockAlerts({sessionToken:'invalid'}).allowed,false);
 const token=login('bank-hn-staff-001');
 sessionGateway.simulateAdminMembershipRevocation('bank-hn-staff-001');
 assert.equal(app.fetchOwnMockAlerts({sessionToken:token}).allowed,false);
 const second=setup(),token2=second.login('agent-ni-staff-001');
 now+=900000;
 assert.equal(second.app.fetchOwnMockAlerts({sessionToken:token2}).allowed,false);
});
test('no admite conexión a servidor no verificado ni modo live',()=>{
 assert.throws(()=>createMockInstitutionAuthorizedAlerts({sessionGateway:{mode:'live',authorizeMockSession:()=>({allowed:true})}}),/sólo DEMO/);
});
