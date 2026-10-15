import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail } from '../src/privacy.mjs';

test('no muestra completa la dirección personal en las pantallas', () => {
  assert.equal(maskEmail('persona.ejemplo@gmail.com'), 'p••••@gmail.com');
  assert.equal(maskEmail('a@ejemplo.com'), 'a••••@ejemplo.com');
  assert.equal(maskEmail('  cuenta@dominio.org  '), 'c••••@dominio.org');
});
test('no filtra valores mal formados al mostrarlos en pantalla', () => {
  for (const x of [null, undefined, '', 'correo', '@correo.com', 'usuario@']) {
    assert.equal(maskEmail(x), '••••');
  }
});
