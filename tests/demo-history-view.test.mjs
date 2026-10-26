import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareRecentDemoHistory, summarizeRecentDemoHistory, filterRecentDemoHistory,
  verifiedPagedMerchantDirection,
} from '../src/demo-history-view.mjs';

const me = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const validDate = '2026-10-24T10:00:00Z';
const mk = (id, kind, from, to, amount_cents, extra={}) => ({
  id, kind, source_user_id:from, destination_user_id:to,
  amount_cents, created_at:validDate, ...extra,
});
const classify = (op, userId) => {
  if (op.kind === 'contribution') return op.source_user_id === userId ? {sign:'-',label:'Aportación'} : null;
  if (op.kind !== 'transfer') return null;
  if (op.source_user_id === userId) return {sign:'-',label:'Enviado'};
  if (op.destination_user_id === userId) return {sign:'+',label:'Recibido'};
  return null;
};
const input = [
  mk('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','transfer',other,me,1050),
  mk('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','transfer',me,other,2250,{is_merchant_payment:true}),
  mk('cccccccc-cccc-4ccc-8ccc-cccccccccccc','contribution',me,null,345),
  mk('dddddddd-dddd-4ddd-8ddd-dddddddddddd','transfer',other,outsider,10000),
];

test('solo incluye operaciones propias y válidas', () => {
  const rows=prepareRecentDemoHistory(input,me,classify);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(row=>row.direction),['incoming','outgoing','outgoing']);
});
test('resume solo movimientos recientes en céntimos exactos, sin confundirlos con saldo', () => {
  const rows=prepareRecentDemoHistory(input,me,classify);
  assert.deepEqual(summarizeRecentDemoHistory(rows), {
    incomingCents:1050,outgoingCents:2595,incomingCount:1,outgoingCount:2,
  });
});
test('filtros separan entradas, salidas y comercio', () => {
  const rows=prepareRecentDemoHistory(input,me,classify);
  assert.equal(filterRecentDemoHistory(rows,'incoming').length,1);
  assert.equal(filterRecentDemoHistory(rows,'outgoing').length,2);
  assert.equal(filterRecentDemoHistory(rows,'merchant').length,1);
  assert.equal(filterRecentDemoHistory(rows,'all').length,3);
});
test('descarta importes malformados, fechas e identificadores inválidos', () => {
  const invalid=[
    mk('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','transfer',me,other,1.25),
    mk('not-a-uuid','transfer',me,other,100),
    mk('ffffffff-ffff-4fff-8fff-ffffffffffff','transfer',me,other,100,{created_at:'no-date'}),
    mk('abababab-abab-4aba-8aba-abababababab','transfer',me,other,-20),
  ];
  assert.deepEqual(prepareRecentDemoHistory(invalid,me,classify),[]);
});
test('no muestra operaciones si cambia o falta usuario', () => {
  assert.deepEqual(prepareRecentDemoHistory(input,'',classify),[]);
  assert.deepEqual(prepareRecentDemoHistory(input,outsider,classify),[
    ...prepareRecentDemoHistory([input[3]],outsider,classify),
  ]);
});

test('historial completo identifica pago y cobro a comercio solo con evidencia de la misma operación', () => {
  const sent=input[1];
  const row={id:sent.id,kind:'transfer',direction:'enviado',amountMwd:'22.50',createdAt:validDate};
  assert.equal(verifiedPagedMerchantDirection(row,input,me),'merchantSent');

  const received=mk('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','transfer',other,me,350,
    {is_merchant_payment:true});
  assert.equal(verifiedPagedMerchantDirection({id:received.id,kind:'transfer',
    direction:'recibido',amountMwd:'3.50',createdAt:validDate},[received],me),'merchantReceived');
});

test('no atribuye pago comercial sin coincidencia de cuenta, monto, fecha, tipo y marcador', () => {
  const sent=input[1];
  const row={id:sent.id,kind:'transfer',direction:'enviado',amountMwd:'22.50',createdAt:validDate};
  assert.equal(verifiedPagedMerchantDirection(row,[],me),null);
  assert.equal(verifiedPagedMerchantDirection(row,input,other),null);
  assert.equal(verifiedPagedMerchantDirection({...row,amountMwd:'22.51'},input,me),null);
  assert.equal(verifiedPagedMerchantDirection({...row,createdAt:'2026-10-24T10:00:01Z'},input,me),null);
  assert.equal(verifiedPagedMerchantDirection({...row,kind:'contribution'},input,me),null);
  assert.equal(verifiedPagedMerchantDirection({...row,direction:'recibido'},input,me),null);
  assert.equal(verifiedPagedMerchantDirection(row,[{...sent,is_merchant_payment:false}],me),null);
});
