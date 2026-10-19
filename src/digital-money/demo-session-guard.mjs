// Protege la billetera MWD de respuestas asíncronas de otras sesiones.
// Es solo un control de interfaz: la autorización real debe imponerse en Supabase (RLS/RPC).
export function createDemoSessionGuard() {
  let owner = null;
  let version = 0;
  let request = 0;
  const valid = x => typeof x === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
  return {
    setOwner(userId) {
      const next = valid(userId) ? userId.toLowerCase() : null;
      if (owner === next) return false;
      owner = next;
      version += 1; // A -> B -> A sigue invalidando respuestas de la primera sesión A.
      request += 1;
      return true;
    },
    capture(userId) {
      if (!valid(userId) || owner !== userId.toLowerCase()) return null;
      return { owner, version };
    },
    sameSession(ticket) {
      return !!ticket && owner === ticket.owner && version === ticket.version;
    },
    begin(userId) {
      if (!valid(userId) || owner !== userId.toLowerCase()) return null;
      request += 1;
      return { owner, version, request };
    },
    current(ticket) {
      return ticket !== null && ticket !== undefined &&
        owner === ticket.owner && version === ticket.version &&
        request === ticket.request;
    },
  };
}

/**
 * Candado local para operaciones DEMO: una operación de una sesión cerrada
 * jamás podrá liberar el candado de una operación nueva de otra sesión.
 * Su existencia no sustituye la idempotencia implementada en PostgreSQL.
 */
export function createDemoOperationGate() {
 let pending = null;
 return {
  isBusy() { return pending!==null; },
  acquire() {
   if (pending!==null) return null;
   const token={};
   pending=token;
   return token;
  },
  release(token) {
   if (!token || pending!==token) return false;
   pending=null;
   return true;
  },
  reset() { pending=null; },
 };
}
