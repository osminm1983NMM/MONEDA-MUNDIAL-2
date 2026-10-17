// MWD ficticios: vincular una solicitud de prueba a la identidad que la inició.
// Nunca procesa dinero real ni sustituye verificación de permisos en el servidor.
import {canApplySessionResponse} from './session-guards.mjs';

export function canReusePendingDemoOperation(pending, requested) {
  return typeof requested?.userId==='string' && requested.userId.length>0 &&
    pending?.userId===requested.userId &&
    pending?.type===requested.type &&
    pending?.cents===requested.cents &&
    pending?.code===requested.code;
}

export async function demoOperationStillBelongsToUser(auth, requestedUserId) {
  if(typeof requestedUserId!=='string'||!requestedUserId) return false;
  try {
    const {data,error}=await auth.getSession();
    return !error && canApplySessionResponse(requestedUserId,data?.session);
  }catch{
    return false;
  }
}

// Adquirir el bloqueo ANTES del primer await; dos pulsaciones no pueden enviar dos RPC.
export function claimDemoOperationLock(busyRef) {
  if (!busyRef || busyRef.current !== false) return false;
  busyRef.current = true;
  return true;
}
