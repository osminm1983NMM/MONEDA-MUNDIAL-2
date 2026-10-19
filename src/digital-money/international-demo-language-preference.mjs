// Preferencia local, sin credenciales, cuentas ni datos personales.
// Solo afecta la pantalla internacional de planificación DEMO.
export const INTERNATIONAL_DEMO_LANGUAGE_KEY='moneda-mundial:international-language-demo:v1';
export const INTERNATIONAL_DEMO_LANGUAGE_CHOICES=Object.freeze(['auto','es','en']);
export function decodeInternationalDemoLanguagePreference(raw){
  return raw==='es'||raw==='en'?raw:'auto';
}
export function resolveInternationalDemoLanguage(preference,deviceLanguage){
  const selected=decodeInternationalDemoLanguagePreference(preference);
  return selected==='auto'?(deviceLanguage==='en'?'en':'es'):selected;
}
export async function saveInternationalDemoLanguagePreference(storage,preference){
  if(!storage||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||
     !INTERNATIONAL_DEMO_LANGUAGE_CHOICES.includes(preference))
    throw new Error('Preferencia de idioma inválida');
  if(preference==='auto')await storage.removeItem(INTERNATIONAL_DEMO_LANGUAGE_KEY);
  else await storage.setItem(INTERNATIONAL_DEMO_LANGUAGE_KEY,preference);
}
