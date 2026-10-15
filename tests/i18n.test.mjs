import {test} from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppLanguage, translate, formatLocalizedDate, LANGUAGE_MODES } from '../src/i18n.mjs';

test('detecta idioma nativo de Reino Unido y países angloparlantes',()=>{
  for(const tag of ['en-GB','en-US','en_AU','EN']) assert.equal(resolveAppLanguage('auto',tag),'en');
  for(const tag of ['es-HN','es-EC','tr-TR','pt-BR','de-DE']) assert.equal(resolveAppLanguage('auto',tag),'es');
});
test('idioma manual prevalece sobre teléfono',()=>{
  assert.equal(resolveAppLanguage('es','en-GB'),'es');
  assert.equal(resolveAppLanguage('en','es-HN'),'en');
  assert.deepEqual(LANGUAGE_MODES,['auto','es','en']);
});
test('traducción no cambia cantidades ni códigos de autorización',()=>{
  assert.equal(translate('SIN VALOR FINANCIERO · SIN DINERO REAL','en'),'NO FINANCIAL VALUE · NO REAL MONEY');
  assert.equal(translate('Transferencia enviada','en'),'Transfer sent');
  assert.equal(translate('Transferencia enviada','es'),'Transferencia enviada');
  assert.equal(translate('MWD-0123456789ABCDEF','en'),'MWD-0123456789ABCDEF');
  assert.equal(formatLocalizedDate('invalida','en'),'');
});
