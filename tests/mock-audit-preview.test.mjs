import test from 'node:test';
import assert from 'node:assert/strict';
import {listMockAuditPreview} from '../src/admin/mock-audit-preview.mjs';
test('vista de propietario usa sólo datos inventados y nunca verifica auditoría real',()=>{
 const x=listMockAuditPreview();
 assert.equal(x.total,4);
 assert.equal(x.source,'hardcoded_example_only');
 assert.equal(x.databaseConnected,false);
 assert.equal(x.canEdit,false);
 assert.equal(x.realAuditVerified,false);
});
test('filtro por país sólo muestra sus ejemplos',()=>{
 assert.equal(listMockAuditPreview({country:'HN'}).total,3);
 assert.equal(listMockAuditPreview({country:'NI'}).total,1);
 assert.ok(listMockAuditPreview({country:'NI'}).events.every(x=>x.country==='NI'));
 assert.throws(()=>listMockAuditPreview({country:'US'}),/inválido/);
});
