import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLatestRequest, isValidDemoQuoteResponse, isValidDemoPaymentPreview } from '../src/async-demo-guards.mjs';
import { quoteInternationalDemo } from '../src/international-demo.mjs';

test('las consultas antiguas no sustituyen respuestas actuales', () => {
  assert.equal(isLatestRequest(2,2), true);
  assert.equal(isLatestRequest(1,2), false);
  assert.equal(isLatestRequest(0,0), false);
  assert.equal(isLatestRequest(undefined,2), false);
});

test('solo se muestra una cotización que corresponde exactamente al formulario', () => {
  const quote = quoteInternationalDemo({destination:'CR',amountCents:10000,method:'card'});
  const request = {destination:'CR',amountCents:10000,method:'card'};
  assert.equal(isValidDemoQuoteResponse(quote,request),true);
  assert.equal(isValidDemoQuoteResponse(quote,{...request,destination:'EC'}),false);
  assert.equal(isValidDemoQuoteResponse(quote,{...request,amountCents:20000}),false);
  assert.equal(isValidDemoQuoteResponse(quote,{...request,method:'bank'}),false);
  assert.equal(isValidDemoQuoteResponse({...quote,totalPayCents:10000},request),false);
  assert.equal(isValidDemoQuoteResponse({...quote,realPaymentsEnabled:true},request),false);
  assert.equal(isValidDemoQuoteResponse({...quote,receiverAmountCents:99999},request),false);
  assert.equal(isValidDemoQuoteResponse(null,request),false);
});

test('una cotización de moneda USD solo presenta monto receptor coherente', () => {
  const quote = quoteInternationalDemo({destination:'EC',amountCents:10000,method:'bank'});
  const request = {destination:'EC',amountCents:10000,method:'bank'};
  assert.equal(isValidDemoQuoteResponse(quote,request),true);
  assert.equal(isValidDemoQuoteResponse({...quote,receiverAmountCents:100},request),false);
});

test('solo se muestra un cobro MWD con ID e importe válidos', () => {
  const id='00000000-0000-4000-8000-000000000001';
  const ok={id,currency_code:'MWD',status:'pending',amount_cents:200};
  assert.equal(isValidDemoPaymentPreview(ok,id),true);
  assert.equal(isValidDemoPaymentPreview({...ok,id:'otro'},id),false);
  assert.equal(isValidDemoPaymentPreview({...ok,currency_code:'USD'},id),false);
  assert.equal(isValidDemoPaymentPreview({...ok,amount_cents:0},id),false);
  assert.equal(isValidDemoPaymentPreview({...ok,status:'unknown'},id),false);
  assert.equal(isValidDemoPaymentPreview(null,id),false);
});
