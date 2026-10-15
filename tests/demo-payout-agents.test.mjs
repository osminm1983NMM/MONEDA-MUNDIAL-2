import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PAYOUT_AGENTS,searchDemoPayoutAgents} from '../src/demo-payout-agents.mjs';
test('busca agentes inventados por país, ciudad y moneda',()=>{
 assert.equal(searchDemoPayoutAgents('NI').length,1);
 assert.equal(searchDemoPayoutAgents('CR','san josé').length,1);
 assert.equal(searchDemoPayoutAgents('JP','JPY').length,1);
 assert.equal(searchDemoPayoutAgents('CR','USD').length,1);
 assert.equal(searchDemoPayoutAgents('CR','Quito').length,0);
 assert.deepEqual(searchDemoPayoutAgents('XX'),[]);
});
test('ningún agente ficticio tiene dirección real, pagos o acuerdos',()=>{
 assert.ok(DEMO_PAYOUT_AGENTS.length>=6);
 for(const agent of DEMO_PAYOUT_AGENTS){
  assert.equal(agent.mode,'fictional_sample');
  assert.equal(agent.partnerAuthorized,false);
  assert.equal(agent.realPaymentsEnabled,false);
  assert.equal(agent.redeemable,false);
  assert.equal(agent.address,null);
  assert.equal(agent.phone,null);
 }
});
