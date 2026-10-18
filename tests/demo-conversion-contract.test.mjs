import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDemoQuote,validateDemoReceipt,validateDemoHistory} from '../src/digital-money/demo-conversion-contract.mjs';
const id='123e4567-e89b-42d3-a456-426614174000', other='223e4567-e89b-42d3-a456-426614174000';
const now=Date.parse('2026-10-18T19:00:00Z');
const q={quoteId:id,provider:'synthetic_sandbox',status:'quoted',fromAsset:'COIN',toAsset:'STABLE',
 amountInMicro:1000000,grossOutMicro:125000,feeOutMicro:313,amountOutMicro:124687,
 stablePerCoin:0.125,expiresAt:'2026-10-18T19:01:30+00:00',realPaymentsEnabled:false,priceIsReal:false};
test('cotización simulada válida solo para origen, importe y vencimiento solicitados',()=>{
 assert.equal(validateDemoQuote(q,'COIN',1000000,now)?.amountOutMicro,124687);
 assert.equal(validateDemoQuote({...q,amountInMicro:'1000000'},'COIN',1000000,now)?.amountInMicro,1000000);
 for(const field of [
  {realPaymentsEnabled:true},{realPaymentsEnabled:undefined},{priceIsReal:true},
  {provider:'market'},{status:'executed'},{quoteId:'bad'},{fromAsset:'STABLE'},
  {toAsset:'COIN'},{amountInMicro:1000001},{grossOutMicro:125001},
  {amountOutMicro:-1},{feeOutMicro:-1},{stablePerCoin:0},
  {expiresAt:'2026-10-18T18:59:00Z'},{expiresAt:'2026-10-18T19:04:00Z'},
 ])assert.equal(validateDemoQuote({...q,...field},'COIN',1000000,now),null,JSON.stringify(field));
 assert.equal(validateDemoQuote(q,'STABLE',1000000,now),null);
});
test('recibo ficticio coincide en cotización, monedas, montos y comisión',()=>{
 const receipt={status:'ok',quoteId:id,conversionId:other,realPaymentsEnabled:false,
   fromAsset:'COIN',toAsset:'STABLE',amountInMicro:1000000,amountOutMicro:124687,feeOutMicro:313};
 assert.equal(validateDemoReceipt(receipt,q),true);
 assert.equal(validateDemoReceipt({status:'already_processed',quoteId:id,conversionId:other,
    realPaymentsEnabled:false},q),true);
 for(const patch of [{realPaymentsEnabled:true},{realPaymentsEnabled:undefined},
  {quoteId:other},{conversionId:'invalid'},{status:'pending'},
  {fromAsset:'STABLE'},{toAsset:'COIN'},{amountInMicro:1000001},
  {amountOutMicro:124688},{feeOutMicro:0},{feeOutMicro:-1}])
    assert.equal(validateDemoReceipt({...receipt,...patch},q),false,JSON.stringify(patch));
});
test('historial inválido nunca aparece como saldo o operación válida',()=>{
 const row={id,fromAsset:'COIN',toAsset:'STABLE',amountInMicro:'1000000',
   amountOutMicro:124687,feeOutMicro:313,priceSnapshot:'0.12500000',settledAt:'2026-10-18T19:02:00Z'};
 assert.equal(validateDemoHistory([row])?.[0]?.amountInMicro,1000000);
 assert.equal(validateDemoHistory([row])?.[0]?.feeOutMicro,313);
 assert.deepEqual(validateDemoHistory([]),[]);
 for(const patch of [{amountOutMicro:NaN},{toAsset:'COIN'},{feeOutMicro:undefined},
  {feeOutMicro:-1},{priceSnapshot:0},{priceSnapshot:'NaN'},{settledAt:'invalid'}])
   assert.equal(validateDemoHistory([{...row,...patch}]),null,JSON.stringify(patch));
 assert.equal(validateDemoHistory(null),null);
});
