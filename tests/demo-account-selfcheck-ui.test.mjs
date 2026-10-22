import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOME_DEMO_TEXT} from '../src/digital-money/home-demo-i18n.mjs';

test('el autodiagnóstico está conectado exclusivamente a una sesión iniciada',()=>{
  const app=readFileSync(new URL('../App.js',import.meta.url),'utf8');
  const screen=readFileSync(new URL('../DemoAccountSelfcheckScreen.js',import.meta.url),'utf8');
  assert.match(app,/import DemoAccountSelfcheckScreen from '\.\/DemoAccountSelfcheckScreen'/);
  assert.match(app,/screen === 'Seguridad' && <DemoAccountSelfcheckScreen key=\{userId\}/);
  assert.match(app,/sessionGuard=\{sessionGuardRef\.current\}/);
  assert.match(app,/onPress=\{\(\) => navigate\('Seguridad'\)\}/);
  assert.match(screen,/runDemoAccountSelfcheck\(\{supabase,userId,isCurrent\}\)/);
  assert.match(screen,/sessionGuard\.sameSession\(ticket\)/);
  assert.doesNotMatch(screen,/signInWithPassword|service_role|\.insert\(|\.update\(|\.delete\(/);
});
test('ambos idiomas etiquetan la prueba como solo DEMO sin dinero real',()=>{
 for(const lang of ['es','en']){
   const labels=HOME_DEMO_TEXT[lang];
   for(const key of ['selfcheckButton','selfcheckTitle','selfcheckHelp','selfcheckRun',
     'selfcheckBusy','selfcheckPass','selfcheckFail','selfcheckLimit']){
     assert.ok(typeof labels[key]==='string' && labels[key].length>8,lang+':'+key);
   }
 }
 assert.match(HOME_DEMO_TEXT.es.selfcheckLimit,/NO certifica/);
 assert.match(HOME_DEMO_TEXT.en.selfcheckLimit,/does NOT certify/);
});
