import test from 'node:test';
import assert from 'node:assert/strict';
import {REAL_MONEY_GATES,assessRealMoneyLaunchReadiness} from '../src/real-money-launch-gates.mjs';
const route={origin:'US',destination:'HN',sourceCurrency:'USD',destinationCurrency:'HNL'};
test('nunca habilita pagos reales con todos los requisitos falsos',()=>{
 const r=assessRealMoneyLaunchReadiness({corridor:route});
 assert.equal(r.missingRequirements.length,REAL_MONEY_GATES.length);
 assert.equal(r.canMoveMoney,false);
 assert.equal(r.canHoldCustomerFunds,false);
});
test('todas las evidencias aparentes no sustituyen autorización de producción',()=>{
 const evidence=Object.fromEntries(REAL_MONEY_GATES.map(k=>[k,{verified:true,reference:'demo-ref'}]));
 const r=assessRealMoneyLaunchReadiness({corridor:route,evidence});
 assert.equal(r.readiness,'requires_independent_authorization');
 assert.equal(r.canMoveMoney,false);
 assert.equal(r.operationalApproval,false);
 assert.equal(r.canGenerateRedeemableCode,false);
});
test('corredor mal formado o doméstico no supera validación',()=>{
 for(const destination of ['USA','US','ZZZ']){
  const r=assessRealMoneyLaunchReadiness({corridor:{...route,destination}});
  assert.equal(r.validCorridor,false);
  assert.equal(r.realPaymentsEnabled,false);
 }
});
test('evidencias sin referencia auditable permanecen pendientes',()=>{
 const r=assessRealMoneyLaunchReadiness({corridor:route,evidence:{legal_entity:{verified:true,reference:'  '}}});
 assert.ok(r.missingRequirements.includes('legal_entity'));
});
