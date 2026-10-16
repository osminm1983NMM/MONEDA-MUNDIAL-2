import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePartnerExpiryDate, classifyPartnerExpiry } from '../src/partner-expiry-dates.mjs';

test('Acepta vencimientos en ISO estricto, incluido bisiesto, y fecha vacía',()=>{
  assert.deepEqual(parsePartnerExpiryDate('2028-02-29'),{valid:true,date:'2028-02-29'});
  assert.deepEqual(parsePartnerExpiryDate(' '),{valid:true,date:null});
  for(const bad of ['2027-02-29','2026-04-31','2026-13-01','2026-01-00',
    '2026-1-01','2026/10/16','1899-12-31','2101-01-01','xx','2026-12-1']) {
    assert.equal(parsePartnerExpiryDate(bad).valid,false,bad);
  }
});
test('Alertas a 30, 60 y 90 días sin convertir zonas horarias',()=>{
  const today='2026-10-16';
  assert.equal(classifyPartnerExpiry(null,today),'missing_date');
  assert.equal(classifyPartnerExpiry('2026-10-15',today),'expired');
  assert.equal(classifyPartnerExpiry('2026-10-16',today),'due_soon');
  assert.equal(classifyPartnerExpiry('2026-11-15',today,30),'due_soon');
  assert.equal(classifyPartnerExpiry('2026-11-16',today,30),'later');
  assert.equal(classifyPartnerExpiry('2026-11-16',today,60),'due_within_window');
  assert.equal(classifyPartnerExpiry('2027-01-01',today,60),'later');
  assert.equal(classifyPartnerExpiry('2027-01-01',today,90),'due_within_window');
  assert.equal(classifyPartnerExpiry('2026-02-29',today),'invalid');
  assert.equal(classifyPartnerExpiry('2026-11-16',today,0),'invalid');
});
