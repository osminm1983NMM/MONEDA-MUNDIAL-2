import test from 'node:test';
import assert from 'node:assert/strict';
import {
 getMobileProviderOutreachDraft,MOBILE_PROVIDER_OUTREACH_REAL_PAYMENTS_ENABLED,
 MOBILE_PROVIDER_OUTREACH_AUTOSEND_ENABLED,
} from '../src/digital-money/mobile-provider-outreach.mjs';

const providers=['CANDIDATE-NIUM','CANDIDATE-TERRAPAY','CANDIDATE-THUNES'];
test('tres borradores específicos en inglés solo para estudio EEUU-Honduras',()=>{
 for(const providerId of providers){
  const d=getMobileProviderOutreachDraft({providerId,destination:'HN'});
  assert.equal(d.providerId,providerId);
  assert.equal(d.destination,'HN');assert.equal(d.origin,'US');
  assert.equal(d.draftOnly,true);assert.equal(d.alreadySent,false);
  assert.equal(d.providerConfirmed,false);assert.equal(d.realPaymentsEnabled,false);
  assert.equal(d.requiresUserReviewAndSubmission,true);
  assert.match(d.message,/Moneda Mundial 2\.0/);
  assert.match(d.message,/Honduras/i);
  assert.match(d.message,/United States/i);
  assert.match(d.message,/not (yet been|been) incorporated|pre-incorporation/i);
  assert.match(d.message,/Nicaragua/);
  assert.match(d.contactUrl,/^https:\/\//);
  assert.ok(Object.isFrozen(d));
 }
 assert.equal(MOBILE_PROVIDER_OUTREACH_REAL_PAYMENTS_ENABLED,false);
 assert.equal(MOBILE_PROVIDER_OUTREACH_AUTOSEND_ENABLED,false);
});
test('no inventa borradores ni habilita rutas globales',()=>{
 for(const destination of ['NI','CR','EC','US','ZZ','hn',null,undefined]){
  for(const providerId of providers){
   assert.equal(getMobileProviderOutreachDraft({providerId,destination}),null);
  }
 }
 for(const providerId of ['','CANDIDATE-UNKNOWN','__proto__','CANDIDATE-NIUM ',null]){
  assert.equal(getMobileProviderOutreachDraft({providerId,destination:'HN'}),null);
 }
});
test('no recopila PII ni asegura acuerdos; se requiere acción explícita del usuario',()=>{
 for(const providerId of providers){
  const d=getMobileProviderOutreachDraft({providerId,destination:'HN'});
  assert.doesNotMatch(d.message,/service_role|sb_secret_|SUPABASE_URL|access_token|api_key/i);
  assert.doesNotMatch(d.message,/we are (licensed|incorporated)|provider approved|funds enabled/i);
  assert.match(d.message,/sandbox/i);
  assert.match(d.message,/KYC\/AML/);
  assert.equal(Object.keys(d).includes('recipientEmail'),false);
 }
});
