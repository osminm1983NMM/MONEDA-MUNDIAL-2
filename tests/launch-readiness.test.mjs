import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LAUNCH_CHECKS,buildLaunchReadinessReport} from '../src/launch-readiness.mjs';
test('ningún requisito de demostración habilita dinero real',()=>{
 const report=buildLaunchReadinessReport({countryCode:'NI'});
 assert.equal(report.scopeCountry,'NI');
 assert.equal(report.readyForRealMoney,false);
 assert.equal(report.activeRealMoneyCountries,0);
 assert.equal(report.confirmedAuthorizedPayoutAgents,0);
 assert.equal(report.realPaymentsEnabled,false);
 assert.equal(report.demoComponents+report.pendingVerification+report.externalRequirements,LAUNCH_CHECKS.length);
 assert.ok(report.externalRequirements>0);
 assert.ok(report.checks.some(x=>x.id==='licenses'&&x.stage==='external_required'));
});
test('país inválido no activa corredores y estados nunca equivalen a licencias',()=>{
 const report=buildLaunchReadinessReport({countryCode:'USA'});
 assert.equal(report.scopeCountry,null);
 assert.equal(report.status,'demo_only');
 assert.ok(report.checks.every(x=>['built_demo','needs_verification','external_required'].includes(x.stage)));
});
