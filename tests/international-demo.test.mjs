import {test} from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_CORRIDORS, quoteInternationalDemo } from '../src/international-demo.mjs';

test('cobertura de destinos centroamericanos y sudamericanos sin activar transferencias reales',()=>{
  for(const code of ['GT','HN','SV','NI','CR','PA','BZ','EC','CO','PE','BO','BR','PY','CL','AR','UY','VE','GY','SR'])
    assert.ok(DEMO_CORRIDORS.some(c=>c.code===code),code);
  assert.ok(DEMO_CORRIDORS.every(c=>c.fxRate === null || (c.currency==='USD' && c.fxRate===1)));
});

test('simulación Ecuador $100 y financiación bancaria',()=>{
  const q=quoteInternationalDemo({destination:'EC',amountCents:10000,method:'bank'});
  assert.equal(q.feeCents,100);
  assert.equal(q.totalPayCents,10100);
  assert.equal(q.receiverAmountCents,10000);
  assert.equal(q.status,'simulation_only');
});
test('método tarjeta exhibe riesgo de pérdida sin falsear rentabilidad',()=>{
  const q=quoteInternationalDemo({destination:'EC',amountCents:10000,method:'card'});
  assert.ok(q.illustrativeMarginCents<0);
  assert.equal(q.receiverAmountCents,10000);
});
test('sin tipo de cambio confirmado, no inventar importe recibido',()=>{
  const q=quoteInternationalDemo({destination:'HN',amountCents:10000});
  assert.equal(q.receiverAmountCents,null);
  assert.equal(q.fxRate,null);
});
test('rechazar importes o destinos no configurados',()=>{
  for(const amountCents of [0,1,99,10000001,2.5,NaN,Infinity,-1]){
    assert.equal(quoteInternationalDemo({destination:'EC',amountCents}),null);
  }
  assert.equal(quoteInternationalDemo({destination:'MX',amountCents:10000}),null);
  assert.equal(quoteInternationalDemo({origin:'ES',destination:'EC',amountCents:10000}),null);
});

test('todas las cotizaciones demo prohíben explícitamente pagos reales', () => {
  for (const corridor of DEMO_CORRIDORS) {
    for (const method of ['bank', 'card']) {
      const result = quoteInternationalDemo({
        destination: corridor.code, amountCents: 10000, method,
      });
      assert.equal(result.status, 'simulation_only');
      assert.equal(result.realPaymentsEnabled, false);
      assert.equal(result.destinationCurrency, corridor.currency);
      assert.ok(Number.isSafeInteger(result.feeCents));
      assert.equal(result.totalPayCents, result.amountCents + result.feeCents);
      if (corridor.currency !== 'USD') {
        assert.equal(result.receiverAmountCents, null);
        assert.equal(result.fxRate, null);
      }
    }
  }
});
