import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const paged = readFileSync(new URL('../PagedDemoHistoryScreen.js', import.meta.url), 'utf8');

test('el refresco manual avisa y solicita recarga paginada después de validar la sesión', () => {
  const start = app.indexOf('async function refreshAccount(');
  const end = app.indexOf('async function refreshMerchant(', start);
  const body = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const check = body.indexOf('isCurrentDemoWalletRefresh(');
  const validated = body.indexOf('validateDemoAccountSnapshot(');
  const trigger = body.indexOf('setHistoryRefreshTick(value => value + 1)');
  const failure = body.indexOf('} catch (error)');
  assert.ok(check >= 0 && check < validated && validated < trigger && trigger < failure);
  assert.match(body, /if \(showFeedback\) \{\s*setRefreshFeedback\('success'\);[\s\S]*?setHistoryRefreshTick\(value => value \+ 1\)/);
  assert.equal(body.match(/setHistoryRefreshTick\(/g)?.length, 1);
});

test('el historial completo observa el refresco y conserva el aislamiento de petición', () => {
  assert.match(app, /<PagedDemoHistoryScreen[^>]*refreshTick=\{historyRefreshTick\}/s);
  assert.match(paged, /recentOperations = \[\], refreshTick = 0/);
  assert.match(paged, /\[expanded, page, userId, supabase, retry, refreshTick\]/);
  assert.match(paged, /if \(!expanded \|\| !userId\) return/);
  assert.match(paged, /requestSequence\.current !== current/);
});
