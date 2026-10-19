import test from 'node:test';import assert from 'node:assert/strict';
import {getWorldResearchCountry} from '../src/digital-money/worldwide-research-countries.mjs';
import {getGuestCashPickupPreview,GUEST_CASH_PICKUP_REAL_PAYMENTS_ENABLED}
 from '../src/guest-cash-pickup-preview.mjs';
test('flujo público de retiro sin móvil bloquea fondos y referencias',()=>{
 assert.equal(GUEST_CASH_PICKUP_REAL_PAYMENTS_ENABLED,false);
 for(const country of ['HN','NI']){
  const p=getGuestCashPickupPreview({destination:country});
  assert.equal(p.destination,country);assert.equal(p.stepCount,5);
  assert.equal(p.codeIssued,false);assert.equal(p.canIssueCode,false);
  assert.equal(p.canWithdraw,false);assert.equal(p.realMoneyEnabled,false);
  assert.equal(p.confirmedProviders,0);assert.equal(p.registeredPayoutAgents,0);
  assert.match(p.reference,/NO EMITIDO/);
  assert.equal(p.contactedSupabase,false);
 }
});
test('idioma inglés y países no confirmados no habilitan retiro',()=>{
 const p=getGuestCashPickupPreview({language:'en',destination:'NI'});
 assert.match(p.reference,/NOT ISSUED/);assert.match(p.blocked,/BLOCKED/);
 for(const code of ['CR','EC','MX','ES','TR','JP']){
  const item=getGuestCashPickupPreview({destination:code,language:'en'});
  assert.equal(item.destination,code);
  assert.equal(item.researchCatalogueSize,249);
  assert.equal(item.routeAvailable,false);
  assert.equal(item.licensedRemittanceCorridor,false);
  assert.equal(item.confirmedProviders,0);
  assert.equal(item.codeIssued,false);
  assert.equal(item.realMoneyEnabled,false);
 }
 assert.equal(getGuestCashPickupPreview({destination:'US'}),null);
 assert.equal(getGuestCashPickupPreview({destination:'ZZ'}),null);
});

test('catálogo completo permite explorar 248 destinos extranjeros sin habilitar pagos',()=>{
 let count=0,visibleDestinations=0;
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
  const code=String.fromCharCode(a,b);
  const row=getWorldResearchCountry(code,'es');
  if(!row)continue;
  count++;
  const preview=getGuestCashPickupPreview({destination:code});
  if(code==='US'){assert.equal(preview,null);continue;}
  visibleDestinations++;
  assert.ok(preview,code);
  assert.equal(preview.destination,code);
  assert.equal(preview.routeAvailable,false);
  assert.equal(preview.licensedRemittanceCorridor,false);
  assert.equal(preview.canWithdraw,false);
  assert.equal(preview.canIssueCode,false);
  assert.equal(preview.codeIssued,false);
  assert.equal(preview.confirmedProviders,0);
  assert.equal(preview.registeredPayoutAgents,0);
  assert.equal(preview.realMoneyEnabled,false);
 }
 assert.equal(count,249);
 assert.equal(visibleDestinations,248);
});
