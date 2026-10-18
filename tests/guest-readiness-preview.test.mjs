import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildProjectLaunchStatus} from '../src/digital-money/project-launch-status.mjs';
import {getProviderResearchOverview} from '../src/digital-money/provider-research-overview.mjs';
test('vista pública usa solamente funciones de investigación sin credenciales',()=>{
 const s=readFileSync('GuestReadinessPreviewScreen.js','utf8');
 assert.ok(s.includes('buildProjectLaunchStatus'));
 assert.ok(s.includes('getProviderResearchOverview'));
 for(const blocked of ['createClient(','.from(','.rpc(','AsyncStorage','fetch(','sendMoney(','process.env']){
  assert.equal(s.includes(blocked),false,blocked);
 }
});
test('lectura de estado y proveedores nunca autoriza remesa o criptomonedas',()=>{
 const status=buildProjectLaunchStatus({destination:'HN',asOf:'2026-10-17'});
 const providers=getProviderResearchOverview({destination:'HN',method:'cash_pickup',asOf:'2026-10-17'});
 assert.equal(status.realTransfersEnabled,false);
 assert.equal(status.coinIssued,false);
 assert.equal(status.digitalIssued,false);
 assert.equal(providers.confirmedProviders,0);
 assert.equal(providers.realTransfersEnabled,false);
});
