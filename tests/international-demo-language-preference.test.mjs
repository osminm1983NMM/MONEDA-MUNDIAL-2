import test from 'node:test';
import assert from 'node:assert/strict';
import {INTERNATIONAL_DEMO_LANGUAGE_KEY,decodeInternationalDemoLanguagePreference,resolveInternationalDemoLanguage,saveInternationalDemoLanguagePreference} from '../src/digital-money/international-demo-language-preference.mjs';
test('modo automático y elección persistida sin información sensible',async()=>{
 const items=new Map();
 const storage={setItem:async(k,v)=>items.set(k,v),removeItem:async k=>items.delete(k)};
 assert.equal(resolveInternationalDemoLanguage('auto','en'),'en');
 assert.equal(resolveInternationalDemoLanguage('auto','es'),'es');
 assert.equal(resolveInternationalDemoLanguage('es','en'),'es');
 await saveInternationalDemoLanguagePreference(storage,'en');
 assert.equal(decodeInternationalDemoLanguagePreference(items.get(INTERNATIONAL_DEMO_LANGUAGE_KEY)),'en');
 await saveInternationalDemoLanguagePreference(storage,'auto');
 assert.equal(items.has(INTERNATIONAL_DEMO_LANGUAGE_KEY),false);
 assert.equal(decodeInternationalDemoLanguagePreference('invalid'),'auto');
 await assert.rejects(saveInternationalDemoLanguagePreference(storage,'fr'));
});
