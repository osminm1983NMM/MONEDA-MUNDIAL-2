// No account/session/API calls. Preview text only; NOT a wallet or payments surface.
const COPY=Object.freeze({
 es:Object.freeze({
  heading:'Conoce Moneda Mundial',
  subtitle:'Vista previa sin iniciar sesión. No muestra tu saldo ni crea operaciones.',
  warning:'DEMOSTRACIÓN • Ningún dinero real está disponible',
  sections:Object.freeze([
   Object.freeze({id:'wallet',title:'Billetera digital',detail:'Conoce el diseño de una billetera. Los créditos MWD de prueba no son dinero.'}),
   Object.freeze({id:'transfers',title:'Transferencias internacionales',detail:'Proyecto de envío entre países. Todavía no se permite transferir fondos verdaderos.'}),
   Object.freeze({id:'merchants',title:'Pagos a comercios',detail:'Conoce el concepto de pagos comerciales; todas las operaciones actuales son simuladas.'}),
   Object.freeze({id:'coins',title:'Digital y Coin',detail:'Dos conceptos en investigación: instrumento estable y moneda de precio variable. Sin emisión pública ni cambio real.'}),
   Object.freeze({id:'countries',title:'Países del mundo',detail:'Honduras es el primer destino de evaluación. Nicaragua y los demás países continúan en el catálogo de diseño; ninguno queda autorizado por aparecer aquí.'})
  ]),
  back:'Volver a iniciar sesión',
  footer:'Esta vista previa no consulta Supabase, no utiliza datos bancarios y no solicita contraseñas.'
 }),
 en:Object.freeze({
  heading:'Explore Moneda Mundial',
  subtitle:'Preview without signing in. It does not display balances or create transactions.',
  warning:'DEMO ONLY • No real money is available',
  sections:Object.freeze([
   Object.freeze({id:'wallet',title:'Digital wallet',detail:'Explore the wallet concept. Test MWD credits are not money.'}),
   Object.freeze({id:'transfers',title:'International transfers',detail:'Planned cross-border transfers. Real funds cannot be transferred yet.'}),
   Object.freeze({id:'merchants',title:'Merchant payments',detail:'Explore the merchant payment concept; all current operations are simulated.'}),
   Object.freeze({id:'coins',title:'Digital and Coin',detail:'Two research concepts: a stable-value instrument and a variable-price coin. No public issuance or real conversion.'}),
   Object.freeze({id:'countries',title:'World countries',detail:'Honduras is the first evaluation destination. Nicaragua and other places remain in the design catalog; listing them does not authorize payments.'})
  ]),
  back:'Back to sign in',
  footer:'This preview does not contact Supabase, access bank details, or request passwords.'
 })
});
export const DEMO_PREVIEW_REAL_PAYMENTS_ENABLED=false;
export function getPublicDemoTour(language='es'){
 return COPY[language==='en'?'en':'es'];
}
