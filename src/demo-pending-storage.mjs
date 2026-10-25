// Registro local de una única operación MWD ficticia aún sin confirmación.
// No almacena credenciales ni autoriza dinero real; la idempotencia final
// depende de las restricciones y RPC del servidor.
const PREFIX = 'mwd:demo:pending:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE = /^MWD-[A-F0-9]{16}$/;

function validUserId(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function pendingDemoKey(userId) {
  if (!validUserId(userId)) throw new Error('Identidad de prueba inválida.');
  return PREFIX + userId;
}

export function isValidDemoPending(value, userId = value?.userId) {
  return value !== null && typeof value === 'object' &&
    value.version === 1 && validUserId(userId) && value.userId === userId &&
    UUID.test(value.id || '') &&
    (value.type === 'transfer' || value.type === 'contribution') &&
    Number.isSafeInteger(value.cents) && value.cents >= 1 &&
    value.cents <= 100000000 &&
    (value.type === 'transfer' ? CODE.test(value.code || '') : value.code === '') &&
    Number.isSafeInteger(value.createdAt) && value.createdAt > 0;
}

export function newDemoPending({userId, type, cents, code = '', id, createdAt = Date.now()}) {
  const pending = {version: 1, userId, type, cents, code, id, createdAt};
  if (!isValidDemoPending(pending)) throw new Error('Solicitud de prueba inválida.');
  return pending;
}

export async function readDemoPending(storage, userId) {
  const raw = await storage.getItem(pendingDemoKey(userId));
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Registro local no legible; no crees otra operación.');
  }
  if (!isValidDemoPending(parsed, userId)) {
    throw new Error('Registro local inválido; requiere revisión antes de enviar.');
  }
  return parsed;
}

export async function saveDemoPending(storage, pending) {
  if (!isValidDemoPending(pending)) throw new Error('Solicitud de prueba inválida.');
  const previous = await readDemoPending(storage, pending.userId);
  if (previous && (previous.id !== pending.id ||
      previous.type !== pending.type || previous.cents !== pending.cents ||
      previous.code !== pending.code)) {
    throw new Error('Hay una operación anterior sin confirmar.');
  }
  // La aplicación debe esperar a que este guardado termine ANTES de enviar RPC.
  await storage.setItem(pendingDemoKey(pending.userId), JSON.stringify(pending));
  return pending;
}

export async function clearDemoPending(storage, pending) {
  if (!isValidDemoPending(pending)) throw new Error('Solicitud de prueba inválida.');
  const current = await readDemoPending(storage, pending.userId);
  if (!current) return;
  if (current.id !== pending.id) {
    throw new Error('La solicitud cambió; no se borró su registro.');
  }
  await storage.removeItem(pendingDemoKey(pending.userId));
}

// Sólo se permite eliminar una solicitud tras respuesta verificada del servidor.
// "unconfirmed" no permite concluir que un envío anterior no haya sido procesado.
export function classifyDemoPendingStatus(pending, response) {
  if (!isValidDemoPending(pending) ||
      response?.mode !== 'sandbox_only' ||
      response?.realPaymentsEnabled !== false ||
      response?.requestId !== pending.id) {
    throw new Error('La respuesta de verificación no coincide con la solicitud.');
  }
  if (response.status === 'unconfirmed') return 'unconfirmed';
  if (response.status !== 'processed' ||
      response.kind !== pending.type ||
      Number(response.amountCents) !== pending.cents ||
      (pending.type === 'transfer' &&
        response.recipientCode !== pending.code)) {
    throw new Error('Datos contradictorios; conservar solicitud para revisión.');
  }
  return 'processed';
}
