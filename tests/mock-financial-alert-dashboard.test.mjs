import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMockAlerts} from '../src/admin/mock-financial-alert-dashboard.mjs';
test('propietario ve las cuatro alertas inventadas sin permiso para operar',()=>{
 const p=projectMockAlerts({role:'owner'});
 assert.equal(p.total,4);assert.equal(p.flagged,3);
 assert.equal(p.canPay,false);assert.equal(p.realMoneyEnabled,false);
});
test('banco solamente ve su país/entidad simulada',()=>{
 const hn=projectMockAlerts({role:'bank',entityId:'bank-hn'});
 assert.equal(hn.total,2);
 assert.ok(hn.alerts.every(a=>a.country==='HN'));
 assert.ok(hn.alerts.every(a=>typeof a.amountCents==='number'));
 const ni=projectMockAlerts({role:'bank',entityId:'bank-ni'});
 assert.equal(ni.total,2);
 assert.ok(ni.alerts.every(a=>a.country==='NI'));
});
test('agente no ve importes ni señales internas',()=>{
 const a=projectMockAlerts({role:'agent',entityId:'agent-hn'});
 assert.equal(a.total,2);
 assert.ok(a.alerts.every(x=>!('amountCents' in x)&&!('signals' in x)));
 assert.equal(a.canApprove,false);
});
test('scope inválido no permite ver nada',()=>{
 assert.equal(projectMockAlerts({role:'bank',entityId:'agent-hn'}).total,0);
 assert.equal(projectMockAlerts({role:'owner',entityId:'bank-hn'}).allowed,false);
 assert.throws(()=>projectMockAlerts({role:'other'}),/inválida/);
});
