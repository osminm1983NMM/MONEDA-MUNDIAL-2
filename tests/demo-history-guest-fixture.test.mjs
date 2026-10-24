import test from 'node:test';
import assert from 'node:assert/strict';
import {GUEST_HISTORY_PREVIEW_USER,guestHistoryFixture} from '../src/demo-history-guest-fixture.mjs';
import {prepareRecentDemoHistory,summarizeRecentDemoHistory,filterRecentDemoHistory} from '../src/demo-history-view.mjs';

function demoClassify(op,id) {
  if (op.kind==='contribution') return op.source_user_id===id ? {sign:'-',label:'Aportación'} : null;
  if (op.kind==='transfer' && op.source_user_id===id) return {sign:'-',label:'Enviado'};
  if (op.kind==='transfer' && op.destination_user_id===id) return {sign:'+',label:'Recibido'};
  return null;
}

test('invitado ve cinco operaciones de ejemplo, nunca mezcla sesiones', () => {
  const data=guestHistoryFixture();
  const own=prepareRecentDemoHistory(data,GUEST_HISTORY_PREVIEW_USER,demoClassify);
  const other=prepareRecentDemoHistory(data,'33333333-3333-4333-8333-333333333333',demoClassify);
  assert.equal(own.length,5);
  assert.equal(other.length,0);
  assert.equal(new Set(own.map(x=>x.id)).size,5);
});

test('filtros públicos producen 2 entradas, 3 salidas y 2 comercios', () => {
  const rows=prepareRecentDemoHistory(guestHistoryFixture(),GUEST_HISTORY_PREVIEW_USER,demoClassify);
  assert.equal(filterRecentDemoHistory(rows,'incoming').length,2);
  assert.equal(filterRecentDemoHistory(rows,'outgoing').length,3);
  assert.equal(filterRecentDemoHistory(rows,'merchant').length,2);
  assert.deepEqual(summarizeRecentDemoHistory(rows),{
    incomingCents:12690,outgoingCents:5700,incomingCount:2,outgoingCount:3,
  });
});

test('cada visita obtiene datos independientes, sin estado compartido', () => {
  const first=guestHistoryFixture();
  first[0].amount_cents=999999;
  assert.equal(guestHistoryFixture()[0].amount_cents,12050);
});
