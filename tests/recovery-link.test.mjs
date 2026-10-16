import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecoveryDeepLink as parse,validateRecoveryPassword as check} from '../src/auth/recovery-link.mjs';
const base='monedamundial://auth/recovery';
const access='mock-access-token-12345',refresh='mock-refresh-token-54321';
const link=base+'#type=recovery&access_token='+access+'&refresh_token='+refresh+'&expires_in=3600';
test('acepta únicamente la ruta correcta sin exponer URL completa',()=>{
 const x=parse(link);assert.equal(x.valid,true);assert.equal(x.recognized,true);
 assert.equal(x.accessToken,access);assert.equal(x.refreshToken,refresh);
 assert.equal(Object.hasOwn(x,'url'),false);
});
test('rechaza enlaces de suplantación, parámetros duplicados y errores',()=>{
 for(const value of [
  base+'#type=recovery&access_token='+access+'&access_token='+access+'&refresh_token='+refresh,
  base+'#type=recovery&type=recovery&access_token='+access+'&refresh_token='+refresh,
  base+'#type=recovery&access_token='+access+'&refresh_token='+refresh+'&refresh_token='+refresh,
  base+'?redirect=evil#type=recovery&access_token='+access+'&refresh_token='+refresh,
  base+'/other#type=recovery&access_token='+access+'&refresh_token='+refresh,
  base+'#type=signup&access_token='+access+'&refresh_token='+refresh,
  base+'#error_code=otp_expired',
  base+'#type=recovery&access_token=short&refresh_token='+refresh,
  base+'#type=recovery&access_token='+access+'&refresh_token=token%20with%20spaces',
  'monedamundial://evil/recovery#type=recovery&access_token='+access+'&refresh_token='+refresh,
  'https://example.org',null
 ])assert.equal(parse(value).valid,false,String(value).slice(0,80));
});
test('rechaza tamaños excesivos y faltantes',()=>{
 assert.equal(parse(link+'x'.repeat(8300)).valid,false);
 assert.equal(parse(base+'#type=recovery&access_token='+access).valid,false);
});
test('no cambia contraseña si la sesión difiere o no viene de recuperación',()=>{
 const input={recoveryActive:true,recoveryUserId:'account-a',sessionUserId:'account-a',
 password:'una-clave-segura-de-pruebas',confirmation:'una-clave-segura-de-pruebas'};
 assert.equal(check(input).allowed,true);
 assert.equal(check({...input,recoveryActive:false}).allowed,false);
 assert.equal(check({...input,sessionUserId:'account-b'}).allowed,false);
 assert.equal(check({...input,recoveryUserId:null}).allowed,false);
 assert.equal(check({...input,password:'short',confirmation:'short'}).reason,'password_length');
 assert.equal(check({...input,confirmation:'otra-clave'}).reason,'password_mismatch');
 assert.equal(check({...input,password:'x'.repeat(257),confirmation:'x'.repeat(257)}).allowed,false);
});
