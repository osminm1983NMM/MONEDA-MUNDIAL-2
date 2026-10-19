import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInternationalDemoLanguage,INTERNATIONAL_DEMO_TEXT,internationalRequirementText,internationalCheckText,internationalProviderCheckText} from '../src/digital-money/international-demo-i18n.mjs';
import {buildInternationalDemoPlan} from '../src/digital-money/international-demo-planner.mjs';
import {buildBeneficiaryVerificationChecklistDemo} from '../src/digital-money/beneficiary-verification-checklist-demo.mjs';
import {assessInternationalProviderCandidateDemo} from '../src/digital-money/international-provider-assessment-demo.mjs';
test('elige inglés por locale inglés y español como respaldo',()=>{
 for(const input of ['en','en-US','en_GB']) assert.equal(normalizeInternationalDemoLanguage(input),'en');
 for(const input of ['es','es-HN','fr-FR','tr-TR',null,undefined]) assert.equal(normalizeInternationalDemoLanguage(input),'es');
 assert.ok(INTERNATIONAL_DEMO_TEXT.es.notice.includes('SOLO DEMOSTRACIÓN'));
 assert.ok(INTERNATIONAL_DEMO_TEXT.en.notice.includes('DEMO ONLY'));
});
test('requisitos y métodos aparecen en el idioma elegido sin activar pagos',()=>{
 const plan=buildInternationalDemoPlan({originCode:'US',destinationCode:'NI',payoutMethod:'cash_pickup'});
 const b=buildBeneficiaryVerificationChecklistDemo(plan);
 const provider=assessInternationalProviderCandidateDemo(plan);
 assert.equal(b.canTransfer,false); assert.equal(provider.canCreateTransfer,false);
 assert.ok(internationalRequirementText('en',plan.requirements,'cash_pickup',6).includes('Licensed'));
 assert.ok(internationalCheckText('en',b.checklist[0]).includes('Licensed'));
 assert.ok(internationalProviderCheckText('en',provider.missing[0]).includes('Authorization'));
 assert.ok(internationalRequirementText('es',plan.requirements,'cash_pickup',6).includes('agentes'));
 for(const lang of ['es','en']){
  for(const id of ['bank_account','card','cash_pickup','wallet'])
   assert.ok(INTERNATIONAL_DEMO_TEXT[lang].methodNames[id]?.length>3);
 }
});
