import test from 'node:test';
import assert from 'node:assert/strict';
import {mwdPendingStorageKey,serializeMwdPending,deserializeMwdPending,validateMwdPending} from '../src/digital-money/mwd-pending-operation-demo.mjs';
const id='11111111-1111-4111-8111-111111111111';
const r={id,type:'transfer',cents:100,code:'MWD-0123456789ABCDEF'};
test('persistencia segura de referencia MWD ficticia por usuario',()=>{
 assert.equal(mwdPendingStorageKey(id),'moneda-mundial:pending-mwd-demo:v1:'+id);
 assert.deepEqual(deserializeMwdPending(serializeMwdPending(r)),r);
 assert.equal(serializeMwdPending({...r,cents:-1}),null);
 assert.equal(serializeMwdPending({...r,code:'invalid'}),null);
 assert.equal(deserializeMwdPending('{'),null);
 assert.equal(deserializeMwdPending('{}'),null);
 assert.equal(mwdPendingStorageKey('invalid'),null);
 assert.equal(validateMwdPending({version:1,mode:'sandbox_only',realPaymentsEnabled:true,...r}),null);
});
test('aportacion ficticia no debe contener beneficiario',()=>{
 assert.deepEqual(deserializeMwdPending(serializeMwdPending({...r,type:'contribution',code:''})),{...r,type:'contribution',code:''});
 assert.equal(serializeMwdPending({...r,type:'contribution'}),null);
});
