import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPasskeyConfigurationResearch,assessPrivilegedActionResearch,PASSKEY_SECURITY_REQUIREMENTS} from '../src/server/passkey-research-policy.mjs';
const base={rpId:'monedamundial.example.com',allowedOrigins:['https://admin.monedamundial.example.com'],userVerification:'required'};
test('una configuración de investigación plausible sigue sin autenticar bancos',()=>{
 const p=assessPasskeyConfigurationResearch(base);
 assert.equal(p.configValidForResearch,true);
 assert.equal(p.employeeAuthenticationActive,false);
 assert.equal(p.actualPasskeyAssertionVerified,false);
 assert.equal(p.canMoveRealMoney,false);
 assert.ok(PASSKEY_SECURITY_REQUIREMENTS.includes('challenge_bound_and_one_time'));
});
test('rechazar HTTP, dominios impostores y orígenes con rutas o puerto',()=>{
 for(const origin of [
  'http://admin.monedamundial.example.com',
  'https://admin.monedamundial.example.com.evil.org',
  'https://admin.monedamundial.example.com:8443',
  'https://admin.monedamundial.example.com/path',
  'https://evilmonedamundial.example.com',
 ])assert.equal(assessPasskeyConfigurationResearch({...base,allowedOrigins:[origin]}).configValidForResearch,false,origin);
});
test('rechazar dominios y políticas débiles',()=>{
 assert.equal(assessPasskeyConfigurationResearch({...base,rpId:'localhost'}).configValidForResearch,false);
 assert.equal(assessPasskeyConfigurationResearch({...base,userVerification:'preferred'}).configValidForResearch,false);
 assert.equal(assessPasskeyConfigurationResearch({...base,challengeTtlSeconds:999}).configValidForResearch,false);
 assert.equal(assessPasskeyConfigurationResearch({...base,allowedOrigins:[]}).configValidForResearch,false);
});
test('acciones privilegiadas están siempre denegadas por preflight',()=>{
 for(const action of ['bank_payout','cash_pickup_release','crypto_exchange','refund_approval']){
  const p=assessPrivilegedActionResearch({action,mfaVerified:true});
  assert.equal(p.recognized,true);
  assert.equal(p.realActionEnabled,false);
  assert.equal(p.decision,'DENY_RESEARCH_ONLY');
 }
});
