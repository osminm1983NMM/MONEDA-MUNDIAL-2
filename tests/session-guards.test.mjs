import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canApplySessionResponse } from '../src/session-guards.mjs';

test('permite mostrar información de la misma cuenta', () => {
  assert.equal(canApplySessionResponse('cuenta-A', { user: { id: 'cuenta-A' } }), true);
});
test('rechaza una respuesta que llega después de cerrar sesión', () => {
  assert.equal(canApplySessionResponse('cuenta-A', null), false);
  assert.equal(canApplySessionResponse('cuenta-A', { user: null }), false);
});
test('rechaza los resultados de otra cuenta', () => {
  assert.equal(canApplySessionResponse('cuenta-A', { user: { id: 'cuenta-B' } }), false);
  assert.equal(canApplySessionResponse('cuenta-B', { user: { id: 'cuenta-A' } }), false);
});
test('rechaza identificadores incompletos', () => {
  assert.equal(canApplySessionResponse('', { user: { id: '' } }), false);
  assert.equal(canApplySessionResponse(undefined, { user: { id: 'cuenta-A' } }), false);
});
