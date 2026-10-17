import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PREVIEW_REAL_PAYMENTS_ENABLED,getPublicDemoTour} from '../src/demo-tour.mjs';
test('public preview never enables funds',()=>{
 assert.equal(DEMO_PREVIEW_REAL_PAYMENTS_ENABLED,false);
 for(const lang of ['es','en','pt',null,undefined]){
   const t=getPublicDemoTour(lang);
   assert.equal(t.sections.length,5);
   assert.ok(t.heading.length>0);
   assert.ok(t.warning.length>0);
   assert.ok(t.footer.length>0);
   assert.ok(t.sections.every(item=>item.id&&item.title&&item.detail));
   assert.equal(new Set(t.sections.map(x=>x.id)).size,5);
   assert.ok(t.back.length>0);
 }
});
test('offline demo preview contains no transaction routes, API or secret config',()=>{
 const joined=JSON.stringify(getPublicDemoTour('es'))+JSON.stringify(getPublicDemoTour('en'));
 assert.doesNotMatch(joined,/sb_(publishable|secret)_|service_role|https:\/\/|\btoken\b/i);
 assert.equal(typeof getPublicDemoTour('es').sections[0].onPress,'undefined');
});
