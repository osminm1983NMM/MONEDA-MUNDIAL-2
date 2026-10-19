import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInternationalDemoPlan} from '../src/digital-money/international-demo-planner.mjs';
import {internationalProviderDiscoveryDemo,internationalLiveTransferDisabled} from '../src/digital-money/international-provider-adapter-contract-demo.mjs';
test('tres proveedores son candidatos solamente; sin ofertas, credenciales o pagos',()=>{
 const plan=buildInternationalDemoPlan({originCode:'US',destinationCode:'HN'});
 for(const providerCode of ['nium','thunes','terrapay']){
  const value=internationalProviderDiscoveryDemo({providerCode,plan});
  assert.equal(value.providerConnected,false);
  assert.equal(value.credentialConfigured,false);
  assert.equal(value.coverageVerified,false);
  assert.equal(value.canQuote,false);
  assert.equal(value.canExecute,false);
  assert.equal(value.exchangeRate,null);
  assert.equal(value.availablePayers,null);
  assert.equal(value.realPaymentsEnabled,false);
 }
 assert.equal(internationalProviderDiscoveryDemo({providerCode:'unknown',plan}),null);
 assert.equal(internationalProviderDiscoveryDemo({providerCode:'nium',plan:{...plan,executionAvailable:true}}),null);
 assert.throws(internationalLiveTransferDisabled,/OPERACION_BLOQUEADA/);
});
