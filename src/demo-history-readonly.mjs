/**
 * Moneda Mundial 2.0 — Etapa 103: consultas de lectura para el historial MWD de pruebas.
 *
 * Integra las tablas YA EXISTENTES de Supabase: public.mwd_wallets y public.mwd_operations.
 * Utilizado por la pantalla de historial paginado de React Native / Expo.
 *
 * Seguridad: la separación real de filas depende de las políticas RLS de Supabase.
 * Este módulo añade filtros de defensa en profundidad y no contiene claves privadas.
 * Nunca utilizar con fondos reales ni confundir MWD ficticio con Coin emitida.
 */

const HISTORY_COLUMNS = 'id,kind,source_user_id,destination_user_id,amount_cents,created_at';
const WALLET_COLUMNS = 'user_id,account_code,balance_cents';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class HistoryAccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HistoryAccessError';
    this.code = code;
  }
}

function reject(code, message) {
  throw new HistoryAccessError(code, message);
}

function clientReady(supabase) {
  if (!supabase?.auth?.getUser || !supabase?.from) {
    reject('CLIENT_MISSING', 'Falta configurar la conexión autenticada de Moneda Mundial.');
  }
}

async function currentUserId(supabase) {
  clientReady(supabase);
  let response;
  try {
    response = await supabase.auth.getUser();
  } catch (_) {
    reject('AUTH_ERROR', 'No se pudo verificar la sesión. Intenta nuevamente.');
  }
  if (response.error) reject('AUTH_ERROR', 'No se pudo verificar la sesión.');
  const id = response.data?.user?.id;
  if (!id) reject('AUTH_REQUIRED', 'Inicia sesión para consultar tu historial.');
  if (!UUID_RE.test(id)) reject('AUTH_ERROR', 'Identificador de sesión no válido.');
  return id;
}

async function sessionStillMatches(supabase, startingId) {
  const current = await currentUserId(supabase);
  if (current !== startingId) reject('SESSION_CHANGED', 'La cuenta cambió; vuelve a cargar el historial.');
}

function cents(raw) {
  if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw < 0) reject('DATA_ERROR', 'Importe no representable con precisión.');
    return String(raw);
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw) && raw.length <= 18) {
    return raw.replace(/^0+(?=\d)/, '');
  }
  reject('DATA_ERROR', 'Importe inválido recibido del servidor.');
}

function decimalFromMinor(value) {
  // Representación exacta de céntimos sin coma flotante ni BigInt (Expo/Hermes).
  const digits = cents(value).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function normalizeOperation(row, userId) {
  const isSender = row.source_user_id === userId;
  const isReceiver = row.destination_user_id === userId;
  if (!isSender && !isReceiver) return null; // Defensa adicional, no reemplaza RLS.
  if (row.kind !== 'transfer' && row.kind !== 'contribution') return null;
  const direction = row.kind === 'contribution'
    ? 'aportacion'
    : (isSender ? 'enviado' : 'recibido');
  return {
    id: row.id,
    kind: row.kind,
    direction,
    amountMwd: decimalFromMinor(row.amount_cents),
    currency: 'MWD_DEMO',
    createdAt: row.created_at,
  };
}

/**
 * Obtiene solo la billetera MWD del usuario autenticado.
 * Se usa publishable key y sesión normal, jamás service_role en el teléfono.
 */
export async function loadMyDemoWallet(supabase) {
  const userId = await currentUserId(supabase);
  let response;
  try {
    response = await supabase.from('mwd_wallets')
      .select(WALLET_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
  } catch (_) {
    reject('READ_FAILED', 'No se pudo consultar la billetera.');
  }
  if (response.error) reject('READ_FAILED', 'No se pudo consultar la billetera.');
  await sessionStillMatches(supabase, userId);
  const row = response.data;
  if (!row) return null;
  if (row.user_id !== userId) reject('ACCESS_ERROR', 'Respuesta incompatible con la cuenta actual.');
  return {
    accountCode: row.account_code,
    balanceMwd: decimalFromMinor(row.balance_cents),
    currency: 'MWD_DEMO',
  };
}

/**
 * Consulta paginada del historial MWD, sin consultar datos de otros usuarios.
 * La RLS del servidor sigue siendo la barrera de seguridad obligatoria.
 */
export async function loadMyDemoHistory(supabase, { page = 0, pageSize = 20 } = {}) {
  if (!Number.isInteger(page) || page < 0 || page > 10000 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    reject('PAGE_ERROR', 'Página o cantidad de resultados no válida.');
  }
  const userId = await currentUserId(supabase);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let response;
  try {
    response = await supabase.from('mwd_operations')
      .select(HISTORY_COLUMNS, { count: 'exact' })
      .or(`source_user_id.eq.${userId},destination_user_id.eq.${userId}`)
      // El conteo y el desplazamiento deben considerar exactamente los tipos
      // que puede representar esta pantalla: nunca crear páginas vacías por
      // movimientos de otra clase (pagos, devoluciones, etc.).
      .in('kind', ['transfer', 'contribution'])
      .order('created_at', { ascending: false })
      // Orden estable cuando dos movimientos comparten el mismo instante.
      .order('id', { ascending: false })
      .range(from, to);
  } catch (_) {
    reject('READ_FAILED', 'No se pudo consultar el historial.');
  }
  if (response.error) reject('READ_FAILED', 'No se pudo consultar el historial.');
  await sessionStillMatches(supabase, userId);
  const rows = (response.data ?? []).map(row => normalizeOperation(row, userId)).filter(Boolean);
  return {
    rows,
    page,
    pageSize,
    total: typeof response.count === 'number' ? response.count : null,
    currency: 'MWD_DEMO',
  };
}
