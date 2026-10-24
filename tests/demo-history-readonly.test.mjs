import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMyDemoWallet, loadMyDemoHistory, HistoryAccessError } from '../src/demo-history-readonly.mjs';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function mockSupabase({ sessions = [USER_A], wallets = [], operations = [], ignoreFilter = false, failRead = false } = {}) {
  const calls = [];
  let index = 0;
  const db = {
    auth: { async getUser() {
      const id = sessions[Math.min(index++, sessions.length - 1)];
      return { data: { user: id ? { id } : null }, error: null };
    } },
    from(table) {
      calls.push(['from', table]);
      const state = { table, equals: null, or: null, range: null, order: null };
      const builder = {
        select(columns, options) { calls.push(['select', columns, options]); return builder; },
        eq(column, value) { state.equals = [column, value]; calls.push(['eq', column, value]); return builder; },
        or(value) { state.or = value; calls.push(['or', value]); return builder; },
        order(column, options) { state.order = [column, options]; return builder; },
        range(start, end) { state.range = [start, end]; calls.push(['range', start, end]); return builder; },
        maybeSingle() { return Promise.resolve(result(true)); },
        then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
      };
      function result(single) {
        if (failRead) return { data: null, error: { message: 'Simulated API failure' }, count: null };
        let items = [...(table === 'mwd_wallets' ? wallets : operations)];
        if (!ignoreFilter) {
          if (state.equals) items = items.filter(x => x[state.equals[0]] === state.equals[1]);
          if (state.or) {
            const id = state.or.match(/source_user_id\.eq\.([^,]+)/)?.[1];
            items = items.filter(x => x.source_user_id === id || x.destination_user_id === id);
          }
        }
        if (state.order) items.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const count = items.length;
        if (state.range) items = items.slice(state.range[0], state.range[1] + 1);
        return { data: single ? (items[0] ?? null) : items, error: null, count };
      }
      return builder;
    },
  };
  return { db, calls };
}

function row(id, source_user_id, destination_user_id, kind = 'transfer', amount_cents = 2500, created_at = '2026-10-24T10:00:00Z') {
  return { id, source_user_id, destination_user_id, kind, amount_cents, created_at };
}

test('lee solo su billetera y representa céntimos exactos', async () => {
  const { db, calls } = mockSupabase({ wallets: [{ user_id: USER_A, account_code: 'MWD-PRUEBA', balance_cents: 1000000 }] });
  assert.deepEqual(await loadMyDemoWallet(db), { accountCode: 'MWD-PRUEBA', balanceMwd: '10000.00', currency: 'MWD_DEMO' });
  assert.ok(calls.some(x => x[0] === 'eq' && x[1] === 'user_id' && x[2] === USER_A));
});

test('sin sesión rechaza antes de consultar tablas', async () => {
  const { db, calls } = mockSupabase({ sessions: [null] });
  await assert.rejects(() => loadMyDemoHistory(db), e => e instanceof HistoryAccessError && e.code === 'AUTH_REQUIRED');
  assert.equal(calls.length, 0);
});

test('historial clasifica enviado, recibido y aportación', async () => {
  const { db } = mockSupabase({ operations: [
    row('1', USER_A, USER_B), row('2', USER_B, USER_A), row('3', USER_A, null, 'contribution', 500),
    row('4', USER_B, USER_C),
  ] });
  const result = await loadMyDemoHistory(db);
  assert.deepEqual(result.rows.map(x => x.direction), ['enviado', 'recibido', 'aportacion']);
  assert.equal(result.rows[0].amountMwd, '25.00');
  assert.equal(result.rows.some(x => x.id === '4'), false);
  assert.equal(result.rows[0].source_user_id, undefined);
});

test('segunda barrera oculta filas ajenas aunque un servidor mal configurado las devuelva', async () => {
  const { db } = mockSupabase({ ignoreFilter: true, operations: [row('1', USER_A, USER_B), row('2', USER_B, USER_C)] });
  const result = await loadMyDemoHistory(db);
  assert.deepEqual(result.rows.map(x => x.id), ['1']);
});

test('sesión cambiada durante petición no entrega datos antiguos', async () => {
  const { db } = mockSupabase({ sessions: [USER_A, USER_B], operations: [row('1', USER_A, USER_B)] });
  await assert.rejects(() => loadMyDemoHistory(db), e => e.code === 'SESSION_CHANGED');
});

test('respuesta de billetera de otro usuario se rechaza', async () => {
  const { db } = mockSupabase({ ignoreFilter: true, wallets: [{ user_id: USER_B, account_code: 'OTRO', balance_cents: 100 }] });
  await assert.rejects(() => loadMyDemoWallet(db), e => e.code === 'ACCESS_ERROR');
});

test('paginación fija los límites, sin lecturas ilimitadas', async () => {
  const { db, calls } = mockSupabase({ operations: [
    row('a', USER_A, USER_B, 'transfer', 100, '2026-10-24T12:00:00Z'),
    row('b', USER_A, USER_B, 'transfer', 200, '2026-10-24T11:00:00Z'),
    row('c', USER_A, USER_B, 'transfer', 300, '2026-10-24T10:00:00Z'),
  ] });
  const result = await loadMyDemoHistory(db, { page: 1, pageSize: 2 });
  assert.deepEqual(result.rows.map(x => x.id), ['c']);
  assert.equal(result.total, 3);
  assert.ok(calls.some(x => x[0] === 'range' && x[1] === 2 && x[2] === 3));
});

test('descarta páginas excesivas y valores inválidos', async () => {
  const { db } = mockSupabase();
  await assert.rejects(() => loadMyDemoHistory(db, { page: -1 }), e => e.code === 'PAGE_ERROR');
  await assert.rejects(() => loadMyDemoHistory(db, { pageSize: 1000 }), e => e.code === 'PAGE_ERROR');
});

test('error de servidor se convierte en mensaje seguro', async () => {
  const { db } = mockSupabase({ failRead: true });
  await assert.rejects(() => loadMyDemoHistory(db), e => e.code === 'READ_FAILED' && !e.message.includes('Simulated API failure'));
});

test('impide usar números demasiado grandes o fraccionarios en el historial', async () => {
  for (const amount of [Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    const { db } = mockSupabase({ operations: [row('1', USER_A, USER_B, 'transfer', amount)] });
    await assert.rejects(() => loadMyDemoHistory(db), e => e.code === 'DATA_ERROR');
  }
});

test('identificador de sesión no válido se bloquea', async () => {
  const { db } = mockSupabase({ sessions: ['abc,source_user_id.eq.anything'] });
  await assert.rejects(() => loadMyDemoHistory(db), e => e.code === 'AUTH_ERROR');
});
