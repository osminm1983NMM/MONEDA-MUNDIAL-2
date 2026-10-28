import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const paged = readFileSync(new URL('../PagedDemoHistoryScreen.js', import.meta.url), 'utf8');

test('una sincronización verificada avisa al historial paginado', () => {
  assert.match(app, /setHistoryRefreshSequence\(value => value \+ 1\)/);
  assert.match(app, /refreshSequence=\{historyRefreshSequence\}/);
  assert.match(paged, /refreshSequence = 0/);
  assert.match(paged, /\[expanded, page, userId, supabase, retry, refreshSequence\]/);
});

test('el historial paginado no actualiza datos tras un error ni cambia saldos', () => {
  const successful = app.indexOf('setHistoryRefreshSequence(value => value + 1)');
  const caught = app.indexOf('} catch (error) {', successful);
  assert.ok(successful >= 0 && caught > successful);
  assert.doesNotMatch(paged, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
