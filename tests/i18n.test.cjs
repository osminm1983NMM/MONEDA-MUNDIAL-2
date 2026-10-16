const test=require('node:test');const assert=require('node:assert/strict');
const {inferLanguage,normalizeLanguagePreference,resolveLanguage,translateText,translations}=require('../i18n');
test('regional variants and safe fallback',()=>{assert.equal(inferLanguage('es-NI'),'es');assert.equal(inferLanguage('pt_BR'),'pt');assert.equal(inferLanguage('en-US'),'en');assert.equal(inferLanguage('de-DE'),'en');});
test('auto and explicit preferences',()=>{assert.equal(normalizeLanguagePreference('invalid'),'auto');assert.equal(resolveLanguage('auto','pt-BR'),'pt');assert.equal(resolveLanguage('es','en-US'),'es');});
test('translation and source fallback',()=>{assert.equal(translateText('Cerrar sesión','en'),'Sign out');assert.equal(translateText('Cerrar sesión','pt'),'Sair');assert.equal(translateText('Cerrar sesión','es'),'Cerrar sesión');assert.equal(translateText('texto no traducido','pt'),'texto no traducido');});
test('all translated keys have equal coverage',()=>{assert.deepEqual(Object.keys(translations.en).sort(),Object.keys(translations.pt).sort());});
