import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_DEMO_TEXT} from '../src/digital-money/home-demo-i18n.mjs';
test('portada y billetera tienen las mismas claves ES/EN y mantienen aviso de prueba',()=>{
 const a=Object.keys(HOME_DEMO_TEXT.es).sort(),b=Object.keys(HOME_DEMO_TEXT.en).sort();
 assert.deepEqual(a,b);
 for(const k of a){assert.equal(typeof HOME_DEMO_TEXT.es[k],'string');assert.ok(HOME_DEMO_TEXT.es[k].length);assert.ok(HOME_DEMO_TEXT.en[k].length);}
 assert.match(HOME_DEMO_TEXT.es.warning,/SIN DINERO REAL/);
 assert.match(HOME_DEMO_TEXT.en.warning,/NO REAL MONEY/);
 assert.match(HOME_DEMO_TEXT.en.retryDetail,/same reference/);
});
