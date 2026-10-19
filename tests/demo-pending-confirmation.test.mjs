import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPendingStorageKey, encodePendingDemoQuote, decodePendingDemoQuote, classifyDemoReconciliation }
 from '../src/digital-money/demo-pending-confirmation.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const valid={quoteId:id,status:'quoted',provider:'synthetic_sandbox',fromAsset:'COIN',
 toAsset:'STABLE',amountInMicro:1000000,amountOutMicro:124687,feeOutMicro:313,
 expiresAt:'2026-10-18T19:01:00Z',realPaymentsEnabled:false,priceIsReal:false};
test('la confirmación incierta se guarda sin dinero real ni información sensible',()=>{
 const encoded=encodePendingDemoQuote(valid);
 assert.ok(encoded);
 assert.deepEqual(decodePendingDemoQuote(encoded),{
  quoteId:id,fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,
  amountOutMicro:124687,feeOutMicro:313,expiresAt:'2026-10-18T19:01:00Z',
  realPaymentsEnabled:false
 });
 assert.equal(encoded.includes('provider'),false);
 assert.equal(encoded.includes('priceIsReal'),false);
});
test('se rechazan sesiones o cotizaciones desconocidas',()=>{
 assert.equal(demoPendingStorageKey(id),'moneda-mundial:pending-conversion-demo:v1:'+id);
 assert.equal(demoPendingStorageKey('not-an-id'),null);
 for(const p of [{realPaymentsEnabled:true},{quoteId:'bad'},{fromAsset:'STABLE'},
 {amountInMicro:-1},{expiresAt:'bad'}])
  assert.equal(encodePendingDemoQuote({...valid,...p}),null);
 assert.equal(decodePendingDemoQuote('{}'),null);
 assert.equal(decodePendingDemoQuote('not-json'),null);
});

test('solo una respuesta conciliada consistente desbloquea operaciones DEMO',()=>{
 const pending=decodePendingDemoQuote(encodePendingDemoQuote(valid));
 const data={mode:'sandbox_only',realPaymentsEnabled:false,quoteId:id,
   fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,
   amountOutMicro:124687,feeOutMicro:313,conversionId:null,status:'quoted'};
 assert.equal(classifyDemoReconciliation(data,pending),'quoted');
 assert.equal(classifyDemoReconciliation({...data,status:'expired'},pending),'expired');
 const executed={...data,status:'executed',conversionId:'223e4567-e89b-42d3-a456-426614174000'};
 assert.equal(classifyDemoReconciliation(executed,pending),'executed');
 for(const patch of [{realPaymentsEnabled:true},{mode:'live'},{quoteId:'bad'},
   {amountOutMicro:124688},{fromAsset:'STABLE'},{status:'executed'},
   {status:'expired',conversionId:executed.conversionId},{status:'unknown'}]){
   assert.equal(classifyDemoReconciliation({...data,...patch},pending),null,JSON.stringify(patch));
 }
});
