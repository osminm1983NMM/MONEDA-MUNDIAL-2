// Solo interfaz de DEMO, nunca constituye confirmacion de dinero real.
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function classifyMwdOperationStatus(data, request) {
 if (!data || !request || !uuid(request.id) || data.mode !== 'sandbox_only' ||
     data.realPaymentsEnabled !== false || data.requestId !== request.id) return null;
 // Si el servidor informa «sin confirmar», no debe incluir simultáneamente
 // ningún campo de una operación procesada. Ante contradicción: FALLAR CERRADO.
 if (data.status === 'unconfirmed') {
   if (['operationId','kind','amountCents','recipientCode'].some(
       key => Object.prototype.hasOwnProperty.call(data,key))) return null;
   return 'unconfirmed';
 }
 if (data.status !== 'processed' || !uuid(data.operationId) ||
     data.kind !== request.type || Number(data.amountCents) !== request.cents ||
     !Number.isSafeInteger(Number(data.amountCents))) return null;
 if (request.type === 'transfer' && data.recipientCode !== request.code) return null;
 if (request.type === 'contribution' && data.recipientCode !== null) return null;
 if (!['transfer','contribution'].includes(request.type)) return null;
 return 'processed';
}
