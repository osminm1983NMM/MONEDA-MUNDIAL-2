import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsDemoFeeReview, demoFeeShortfallCents } from '../src/quote-risk.mjs';
import { quoteInternationalDemo } from '../src/international-demo.mjs';

test('advierte margen negativo al simular tarjeta por 100 USD hacia Costa Rica y Ecuador', () => {
  for (const destination of ['CR', 'EC']) {
    const quote = quoteInternationalDemo({ destination, amountCents: 10000, method: 'card' });
    assert.equal(needsDemoFeeReview(quote), true);
    assert.equal(quote.realPaymentsEnabled, false);
  }
});
test('no muestra alerta de pérdida para el mismo envío por cuenta bancaria', () => {
  for (const destination of ['CR', 'EC']) {
    assert.equal(needsDemoFeeReview(
      quoteInternationalDemo({ destination, amountCents: 10000, method: 'bank' })
    ), false);
  }
});
test('nunca muestra alerta de tarifa si el servidor no devuelve una simulación válida', () => {
  assert.equal(needsDemoFeeReview(null), false);
  assert.equal(needsDemoFeeReview({status: 'live', realPaymentsEnabled: true, illustrativeMarginCents: -100}), false);
  assert.equal(needsDemoFeeReview({status: 'simulation_only', realPaymentsEnabled: false, illustrativeMarginCents: '−100'}), false);
});

test('brecha de costos se muestra solo como estimación, nunca como precio autorizado', () => {
  const crCard = quoteInternationalDemo({destination:'CR',amountCents:10000,method:'card'});
  const ecCard = quoteInternationalDemo({destination:'EC',amountCents:10000,method:'card'});
  assert.equal(demoFeeShortfallCents(crCard), 185);
  assert.equal(demoFeeShortfallCents(ecCard), 205);
  assert.equal(demoFeeShortfallCents(quoteInternationalDemo({destination:'CR',amountCents:10000,method:'bank'})),0);
  assert.equal(demoFeeShortfallCents({status:'live',realPaymentsEnabled:true,illustrativeMarginCents:-185,feeCents:115,costEstimateCents:300}),0);
});
