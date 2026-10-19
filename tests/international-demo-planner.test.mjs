import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_COUNTRY_CODE_COUNT,validDemoCountryCode,parseInternationalPlanCents,buildInternationalDemoPlan} from '../src/digital-money/international-demo-planner.mjs';
test('mantiene códigos internacionales completos, incluidos Nicaragua y Honduras',()=>{
 assert.equal(ALL_COUNTRY_CODE_COUNT,249);
 for(const code of ['US','HN','NI','SV','CR','EC','ES','TR','AR','PE','BR','CO'])
  assert.equal(validDemoCountryCode(code),true);
 for(const code of ['XX','ZZ','U','USA',''])assert.equal(validDemoCountryCode(code),false);
});
test('ningún corredor queda habilitado ni promete precio, comisiones o entrega',()=>{
 for(const dst of ['HN','NI','EC','ES','TR']){
  const plan=buildInternationalDemoPlan({originCode:'US',destinationCode:dst,amountUSD:'25.25'});
  assert.equal(plan.originCode,'US');
  assert.equal(plan.destinationCode,dst);
  assert.equal(plan.amountCents,2525);
  assert.equal(plan.realPaymentsEnabled,false);
  assert.equal(plan.executionAvailable,false);
  assert.equal(plan.corridorStatus,'not_enabled');
  assert.equal(plan.quoteAvailable,false);
  for(const key of ['feeCents','exchangeRate','payoutAmount','providerId','destinationCurrency'])assert.equal(plan[key],null);
  assert.ok(plan.requirements.length>=6);
 }
});
test('no permite país inválido, misma jurisdicción o valores monetarios incorrectos',()=>{
 assert.equal(buildInternationalDemoPlan({originCode:'US',destinationCode:'US'}),null);
 assert.equal(buildInternationalDemoPlan({originCode:'US',destinationCode:'ZZ'}),null);
 for(const value of ['-1','0','0.00','12.345','1e4','1000001.00','abc','']){
  assert.equal(parseInternationalPlanCents(value),null,value);
 }
 assert.equal(parseInternationalPlanCents('0.01'),1);
 assert.equal(parseInternationalPlanCents('25,50'),2550);
 assert.equal(parseInternationalPlanCents('1000000'),100000000);
});
