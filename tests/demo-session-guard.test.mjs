import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoSessionGuard} from '../src/digital-money/demo-session-guard.mjs';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';

test('rechaza respuestas antiguas A -> B -> A aunque el identificador regrese',()=>{
 const guard=createDemoSessionGuard();
 assert.equal(guard.setOwner(a),true);
 const first=guard.begin(a);
 assert.equal(guard.current(first),true);
 assert.equal(guard.setOwner(b),true);
 assert.equal(guard.current(first),false);
 const second=guard.begin(b);
 assert.equal(guard.current(second),true);
 assert.equal(guard.setOwner(a),true);
 const third=guard.begin(a);
 assert.equal(guard.current(first),false);
 assert.equal(guard.current(second),false);
 assert.equal(guard.current(third),true);
});
test('última consulta prevalece y cerrar sesión invalida todos los tickets',()=>{
 const guard=createDemoSessionGuard();
 guard.setOwner(a);
 const early=guard.begin(a);
 const late=guard.begin(a);
 assert.equal(guard.current(early),false);
 assert.equal(guard.current(late),true);
 assert.equal(guard.begin(b),null);
 assert.equal(guard.setOwner(null),true);
 assert.equal(guard.current(late),false);
 assert.equal(guard.begin(a),null);
 assert.equal(guard.setOwner(null),false);
});

test('renovar token de la misma cuenta mantiene válida la sesión; cambiarla invalida su operación',()=>{
 const guard=createDemoSessionGuard();
 guard.setOwner(a);
 const operation=guard.capture(a);
 const balanceRequest=guard.begin(a);
 guard.begin(a);
 assert.equal(guard.sameSession(operation),true);
 assert.equal(guard.current(balanceRequest),false);
 assert.equal(guard.setOwner(a),false);
 assert.equal(guard.sameSession(operation),true);
 guard.setOwner(b);
 assert.equal(guard.sameSession(operation),false);
 assert.equal(guard.capture(a),null);
});
