import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newDemoPending, readDemoPending, saveDemoPending, clearDemoPending,
  classifyDemoPendingStatus, pendingDemoKey,
} from '../src/demo-pending-storage.mjs';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const account = 'MWD-0123456789ABCDEF';
const pending = () => newDemoPending({
  userId: ALICE, type: 'transfer', cents: 123, code: account, id: ID,
  createdAt: 1729000000000,
});

function memoryStorage() {
  const map = new Map();
  return {
    map,
    async getItem(key) { return map.has(key) ? map.get(key) : null; },
    async setItem(key, value) { map.set(key, value); },
    async removeItem(key) { map.delete(key); },
  };
}

test('se recupera exactamente la misma solicitud tras una instancia nueva', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  const restored = await readDemoPending(storage, ALICE);
  assert.deepEqual(restored, pending());
  assert.equal(restored.id, ID);
});

test('las solicitudes quedan separadas por identidad', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  assert.equal(await readDemoPending(storage, BOB), null);
  assert.notEqual(pendingDemoKey(ALICE), pendingDemoKey(BOB));
});

test('reintento de la misma solicitud conserva su identificador', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  await saveDemoPending(storage, pending());
  assert.equal((await readDemoPending(storage, ALICE)).id, ID);
});

test('no se permite una operación nueva con la anterior sin confirmar', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  await assert.rejects(saveDemoPending(storage, {...pending(), id: ID2}), /anterior sin confirmar/);
  assert.equal((await readDemoPending(storage, ALICE)).id, ID);
});

test('no se permite cambiar importe ni destino manteniendo la misma clave', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  await assert.rejects(saveDemoPending(storage, {...pending(), cents: 124}), /anterior sin confirmar/);
  assert.equal((await readDemoPending(storage, ALICE)).cents, 123);
});

test('registro ilegible detiene el envío sin sobrescribirlo', async () => {
  const storage = memoryStorage();
  storage.map.set(pendingDemoKey(ALICE), '{corrupto');
  await assert.rejects(readDemoPending(storage, ALICE), /no legible/);
  await assert.rejects(saveDemoPending(storage, pending()), /no legible/);
});

test('un fallo de almacenamiento impide preparar una solicitud nueva', async () => {
  const storage = memoryStorage();
  storage.setItem = async () => { throw new Error('disco lleno'); };
  await assert.rejects(saveDemoPending(storage, pending()), /disco lleno/);
  assert.equal(await readDemoPending(storage, ALICE), null);
});

test('respuesta no confirmada mantiene el registro', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  const response = {mode:'sandbox_only',realPaymentsEnabled:false,status:'unconfirmed',requestId:ID};
  assert.equal(classifyDemoPendingStatus(pending(), response), 'unconfirmed');
  assert.deepEqual(await readDemoPending(storage, ALICE), pending());
});

test('confirmación coincidente permite limpiar el registro', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  const response = {mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',
    requestId:ID,kind:'transfer',amountCents:123,recipientCode:account};
  assert.equal(classifyDemoPendingStatus(pending(), response), 'processed');
  await clearDemoPending(storage, pending());
  assert.equal(await readDemoPending(storage, ALICE), null);
});

test('confirmaciones ajenas o montos contradictorios son rechazados', () => {
  const base = {mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',
    requestId:ID,kind:'transfer',amountCents:123,recipientCode:account};
  assert.throws(() => classifyDemoPendingStatus(pending(), {...base,requestId:ID2}), /no coincide/);
  assert.throws(() => classifyDemoPendingStatus(pending(), {...base,amountCents:999}), /contradictorios/);
  assert.throws(() => classifyDemoPendingStatus(pending(), {...base,recipientCode:'MWD-FFFFFFFFFFFFFFFF'}), /contradictorios/);
});

test('no borra una solicitud distinta por accidente', async () => {
  const storage = memoryStorage();
  await saveDemoPending(storage, pending());
  await assert.rejects(clearDemoPending(storage, {...pending(), id:ID2}), /no se borró/);
  assert.deepEqual(await readDemoPending(storage, ALICE), pending());
});

test('aportación ficticia no guarda código de destinatario', async () => {
  const storage = memoryStorage();
  const contribution = newDemoPending({
    userId:BOB,id:ID2,type:'contribution',cents:200,code:'',createdAt:1729000000001,
  });
  await saveDemoPending(storage, contribution);
  assert.equal(classifyDemoPendingStatus(contribution, {
    mode:'sandbox_only',realPaymentsEnabled:false,status:'processed',
    requestId:ID2,kind:'contribution',amountCents:200,
  }), 'processed');
});
