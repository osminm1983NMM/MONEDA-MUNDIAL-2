// Persistencia de intenciones ficticias: adaptador de almacenamiento inyectado.
// No contiene credenciales ni ejecuta operaciones remotas.
const { validatePendingRemittance } = require('./remittancePendingValidation');
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const prefix = '@mwd/demo-remittance-pending/v1/';
function keyForUser(userId) {
  if (typeof userId !== 'string' || !UUID_V4.test(userId)) throw new Error('Cuenta no válida.');
  return prefix + userId.toLowerCase();
}
function assertStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' ||
      typeof storage.removeItem !== 'function') throw new Error('Almacenamiento no disponible.');
}
async function readPending(storage, userId) {
  assertStorage(storage);
  const raw = await storage.getItem(keyForUser(userId));
  if (raw === null || raw === undefined) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) { throw new Error('Referencia local dañada: requiere conciliación.'); }
  const validated = validatePendingRemittance(parsed, userId);
  if (!validated) throw new Error('Referencia local inválida: requiere conciliación.');
  return validated;
}
async function savePending(storage, userId, pending) {
  assertStorage(storage);
  const validated = validatePendingRemittance(pending, userId);
  if (!validated) throw new Error('No se puede guardar una solicitud inválida.');
  const key = keyForUser(userId);
  const existing = await readPending(storage, userId);
  if (existing && JSON.stringify(existing) !== JSON.stringify(validated)) {
    throw new Error('Existe una solicitud pendiente; resuélvela antes de crear otra.');
  }
  await storage.setItem(key, JSON.stringify(validated));
  const verified = await readPending(storage, userId);
  if (!verified || JSON.stringify(verified) !== JSON.stringify(validated)) {
    throw new Error('No se confirmó el guardado local: no enviar la operación.');
  }
  return validated;
}
async function clearPending(storage, userId, requestId) {
  assertStorage(storage);
  if (typeof requestId !== 'string' || !UUID_V4.test(requestId)) throw new Error('Solicitud no válida.');
  const existing = await readPending(storage, userId);
  if (!existing) return false;
  if (existing.requestId !== requestId) throw new Error('No se puede borrar otra solicitud pendiente.');
  await storage.removeItem(keyForUser(userId));
  if (await readPending(storage, userId)) throw new Error('No se confirmó la eliminación local.');
  return true;
}
module.exports = { keyForUser, readPending, savePending, clearPending };
