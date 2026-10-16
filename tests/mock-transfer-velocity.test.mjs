import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMockTransferVelocity as evaluate,MOCK_VELOCITY_THRESHOLDS as limits}
 from '../src/server/mock-transfer-velocity.mjs';
const NOW=1800000000000;
const sample=(id,alias='SIM-HN-A001',other={})=>({
 eventId:'mock-transfer-'+id+'-001',actorAlias:alias,destination:'HN',
 amountCents:10000,atMs:NOW-1000,outcome:'attempted_mock',...other
});
test('cuatro intentos en una hora producen una señal informativa, no congelan dinero',()=>{
 const x=evaluate({nowMs:NOW,events:[sample('one'),sample('two'),sample('three'),sample('four')]});
 assert.equal(x.totalUniqueEvents,4);
 assert.equal(x.requiresReview,1);
 assert.ok(x.results[0].signals.includes('multiple_attempts_in_hour_mock'));
 assert.equal(x.results[0].canBlockRealFunds,false);
 assert.equal(x.results[0].canPay,false);
 assert.equal(x.results[0].fraudConfirmed,false);
 assert.equal(x.thresholdsForProduction,false);
});
test('la idempotencia evita que reenviar una notificación aumente el número',()=>{
 const a=sample('same'),r=evaluate({nowMs:NOW,events:[a,{...a},a]});
 assert.equal(r.totalUniqueEvents,1);
 assert.equal(r.idempotentRepeats,2);
 assert.equal(r.results[0].attemptsHour,1);
});
test('el mismo identificador con importe, beneficiario ficticio o tiempo distinto falla cerrado',()=>{
 const a=sample('same');
 for(const field of [
  {amountCents:11000},{actorAlias:'SIM-NI-B001'},
  {atMs:NOW-2000},{destination:'NI'}, {outcome:'rejected_mock'}
 ]){
  assert.throws(()=>evaluate({nowMs:NOW,events:[a,{...a,...field}]}),/reutilizado/);
 }
});
test('separación de actores, destinos, rechazos y 24h se evalúan por separado',()=>{
 const events=[
  sample('one','SIM-HN-A001',{destination:'HN',outcome:'rejected_mock'}),
  sample('two','SIM-HN-A001',{destination:'NI',outcome:'rejected_mock'}),
  sample('three','SIM-HN-A001',{destination:'CR',outcome:'rejected_mock'}),
  sample('four','SIM-NI-B001',{destination:'NI',amountCents:100000}),
 ];
 const r=evaluate({nowMs:NOW,events});
 assert.equal(r.cases,2);
 const hn=r.results.find(x=>x.alias==='SIM-HN-A001');
 const ni=r.results.find(x=>x.alias==='SIM-NI-B001');
 assert.equal(hn.rejectedHour,3);
 assert.equal(hn.destinationCountDay,3);
 assert.ok(hn.signals.includes('rejected_attempts_in_hour_mock'));
 assert.ok(hn.signals.includes('multiple_destinations_in_day_mock'));
 assert.equal(ni.requiresManualReview,false);
});
test('límites de ventana exactos, volumen y monto elevado solo para revisión',()=>{
 const r=evaluate({nowMs:NOW,events:[
  sample('old','SIM-HN-A001',{atMs:NOW-24*3600000,amountCents:900000}),
  sample('recent','SIM-HN-A001',{atMs:NOW-3600000,amountCents:600000}),
  sample('now','SIM-HN-A001',{atMs:NOW,amountCents:500000}),
 ]});
 assert.equal(r.results[0].attemptsHour,1);
 assert.equal(r.results[0].amountCentsDay,1100000);
 assert.ok(r.results[0].signals.includes('illustrative_daily_volume_mock'));
 assert.ok(r.results[0].signals.includes('illustrative_high_amount_mock'));
 assert.equal(r.results[0].canReleaseRealFunds,false);
 assert.equal(limits.maxAttemptsPerHour,3);
});
test('rechazo de PII, estados reales y valores manipulados',()=>{
 const e=sample('one');
 for(const row of [
  {...e,bankAccount:'12345'}, {...e,amountCents:1},
  {...e,amountCents:10000001},{...e,atMs:NOW+1},
  {...e,outcome:'settled_real'},{...e,actorAlias:'customer@email.test'},
  {...e,amountCents:NaN}
 ])assert.throws(()=>evaluate({nowMs:NOW,events:[row]}),/inválido/);
 assert.throws(()=>evaluate({nowMs:NaN,events:[e]}),/inválida/);
 assert.throws(()=>evaluate({nowMs:NOW,events:[null]}),/inválido/);
});
test('sin observaciones no presupone autorización ni crea perfiles',()=>{
 const r=evaluate({nowMs:NOW});
 assert.equal(r.cases,0);
 assert.equal(r.requiresReview,0);
 assert.equal(r.realMoneyEnabled,false);
 assert.equal(r.canApprove,false);
});
