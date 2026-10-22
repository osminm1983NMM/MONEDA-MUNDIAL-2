// Comprobación de lectura desde UNA sesión autenticada real de Supabase (solo DEMO).
// getUser() valida el token ante Auth; la API aplica sus RLS a las consultas.
// No almacena contraseñas, JWT, correos ni saldos y nunca modifica el servidor.
// PASS de una sesión NO reemplaza auditoría JWT de dos usuarios ni pruebas de RPC.
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function runDemoAccountSelfcheck({supabase, userId, isCurrent=()=>true}) {
  if (!supabase || !supabase.auth || typeof supabase.auth.getUser!=='function' ||
      typeof supabase.from!=='function' || typeof userId!=='string' ||
      !UUID.test(userId) || typeof isCurrent!=='function') {
    throw new Error('Configuración de comprobación inválida');
  }
  const actor=userId.toLowerCase();
  function assertCurrent() {
    if (!isCurrent()) throw new Error('La cuenta cambió durante la comprobación. Inicia una nueva.');
  }
  async function read(table,fields,filters=[],limit=2) {
    assertCurrent();
    let query=supabase.from(table).select(fields);
    for (const [op,column,value] of filters) {
      if (!query || typeof query[op]!=='function') throw new Error('La consulta segura no está disponible');
      query=query[op](column,value);
    }
    const result=await query.limit(limit);
    assertCurrent();
    if (!result || result.error || !Array.isArray(result.data)) {
      throw new Error('No se pudo comprobar el acceso a '+table);
    }
    return result.data;
  }

  assertCurrent();
  const auth=await supabase.auth.getUser();
  assertCurrent();
  if (auth?.error || !auth?.data?.user ||
      String(auth.data.user.id).toLowerCase()!==actor) {
    throw new Error('No se pudo verificar la identidad con Supabase Auth');
  }

  // Verificar pertenencia con filtros POSITIVOS Y NEGATIVOS:
  // buscar solo los propios con .eq() no descubriría una filtración RLS.
  for (const table of ['mwd_wallets','mwd_profiles']) {
    const own=await read(table,'user_id',[['eq','user_id',actor]],2);
    if (own.length!==1 || String(own[0].user_id).toLowerCase()!==actor) {
      throw new Error('La cuenta no tiene exactamente un registro propio en '+table);
    }
    const other=await read(table,'user_id',[['neq','user_id',actor]],1);
    if (other.length) throw new Error('Acceso ajeno detectado en '+table);
  }
  const tables=[
    ['mwd_admin_roles','user_id'],
    ['mwd_merchants','owner_user_id'],
    ['mwd_payment_requests','merchant_user_id'],
  ];
  for (const [table,column] of tables) {
    const other=await read(table,column,[['neq',column,actor]],1);
    if (other.length) throw new Error('Acceso ajeno detectado en '+table);
  }

  // El destino de una aportación puede ser NULL: un filtro SQL != sobre NULL
  // arrojaría falsos negativos, por eso se comprueban las filas visibles.
  const ops=await read('mwd_operations','source_user_id,destination_user_id',[],100);
  if (ops.length===100) throw new Error('Demasiadas operaciones para una revisión parcial: requiere auditoría paginada');
  if (ops.some(op => !op ||
      (String(op.source_user_id||'').toLowerCase()!==actor &&
       String(op.destination_user_id||'').toLowerCase()!==actor))) {
    throw new Error('Se detectó una operación de otra cuenta');
  }
  assertCurrent();
  return Object.freeze({ status:'pass', mode:'sandbox_only',
    authVerified:true, checkedTables:6, checkedAccount:actor, scope:'single_authenticated_session' });
}
