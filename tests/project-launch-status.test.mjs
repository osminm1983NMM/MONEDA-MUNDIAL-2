import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProjectLaunchStatus,RESEARCH_DESTINATIONS} from '../src/digital-money/project-launch-status.mjs';
test('los países de estudio no equivalen a países habilitados',()=>{
 for(const destination of Object.keys(RESEARCH_DESTINATIONS)){
  const r=buildProjectLaunchStatus({destination,asOf:'2026-10-17'});
  assert.equal(r.liveCountries,0);
  assert.equal(r.realTransfersEnabled,false);
  assert.equal(r.bankConnected,false);
  assert.equal(r.coinIssued,false);
  assert.equal(r.digitalIssued,false);
  assert.equal(r.appInstalledOnUserDeviceConfirmed,false);
  assert.equal(r.fiatRequirementsUnverified,r.fiatRequirementCount);
  assert.equal(r.cryptoPhases.length,3);
  assert.ok(r.cryptoPhases.every(p=>p.missingEvidenceCount===p.requirementCount));
 }
});
test('rechaza país fuera del selector sin afirmar cobertura real',()=>{
 assert.equal(buildProjectLaunchStatus({destination:'ZZ'}),null);
 assert.equal(buildProjectLaunchStatus({destination:'USA'}),null);
 const r=buildProjectLaunchStatus({destination:'HN',asOf:'2026-10-17'});
 assert.equal(r.regulatedPartnerContractConfirmed,false);
 assert.equal(r.status,'research_and_demo_only');
});
