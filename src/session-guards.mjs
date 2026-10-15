// Impide que una respuesta asincrónica iniciada por otro usuario
// actualice datos privados después de cerrar sesión o cambiar de cuenta.
export function canApplySessionResponse(requestedUserId, activeSession) {
  return typeof requestedUserId === 'string' && requestedUserId.length > 0
    && activeSession?.user?.id === requestedUserId;
}
