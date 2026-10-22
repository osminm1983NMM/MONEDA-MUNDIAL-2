const test=require('node:test');
const assert=require('node:assert/strict');
const {parseDemoAmountCents,normalizeDemoCountry,claimDemoFeedback,normalizePickupClaimDemo,verifiedClaimDemoFeedback}=require('../pickupDemoRules');
test('Importes exactos en centavos, límites y entradas inválidas',()=>{
 for(const [input,expected] of [['1',100],['100',10000],['1.02',102],['1,2',120],['1000.00',100000],['0.99',null],['1000.01',null],['10.001',null],['1e3',null],['-1',null],['NaN',null],['1.2.3',null],['',null]]) {
 assert.equal(parseDemoAmountCents(input),expected,input);
 }
});
test('País de referencia',()=>{
 assert.equal(normalizeDemoCountry(' ni '),'NI');
 for(const val of ['','USA','1A','N I',null]) assert.equal(normalizeDemoCountry(val),null);
});
test('Una respuesta no confirmada no se anuncia como pagada',()=>{
 for(const status of ['invalid_code','temporarily_blocked','not_available','unexpected',undefined]) {
 assert.equal(claimDemoFeedback({status}).ok,false);
 }
 assert.equal(claimDemoFeedback({status:'simulated_collected'}).ok,true);
 assert.match(claimDemoFeedback({status:'simulated_collected'}).message,/ficticia/);
});

test('Código ficticio válido se normaliza; formato erróneo no debe llegar al servidor',()=>{
 const valid='SIM-'+'A'.repeat(32);
 assert.equal(normalizePickupClaimDemo(' '+valid.toLowerCase()+' '),valid);
 for(const x of ['','SIM-123','SIM-'+ 'G'.repeat(32),'SIM-'+ 'A'.repeat(33),null])assert.equal(normalizePickupClaimDemo(x),null);
});
test('Un supuesto pago requiere referencia correcta y banderas de DEMO',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const valid={status:'simulated_collected',orderId:id,cashDisbursed:false,realPaymentsEnabled:false};
 assert.equal(verifiedClaimDemoFeedback(valid,id).ok,true);
 for(const override of [
  {orderId:'22222222-2222-4222-8222-222222222222'},
  {cashDisbursed:true},{realPaymentsEnabled:true},{cashDisbursed:undefined}
 ])assert.equal(verifiedClaimDemoFeedback({...valid,...override},id).ok,false);
});
