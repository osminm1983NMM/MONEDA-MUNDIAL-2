// Reglas compartidas para solicitudes ficticias. No valida identidad ni dinero real.
// Se usa tanto desde React Native como en pruebas Node sin dependencias.
function parseDemoAmountCents(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(',', '.');
  // Cantidades decimales exactas; evita errores de punto flotante.
  const match = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 100000
    ? cents : null;
}

function normalizeDemoCountry(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function claimDemoFeedback(response) {
  switch (response?.status) {
    case 'simulated_collected':
      return { ok: true, message: 'Entrega ficticia registrada. No se entregó efectivo.' };
    case 'invalid_code':
      return { ok: false, message: 'Código de prueba incorrecto.' };
    case 'temporarily_blocked':
      return { ok: false, message: 'Orden temporalmente bloqueada por seguridad.' };
    case 'not_available':
      return { ok: false, message: 'Orden vencida, cancelada o ya procesada.' };
    default:
      return { ok: false, message: 'La entrega ficticia no fue confirmada.' };
  }
}
// La app jamás envía al servidor un código incompleto o malformado: evita
// contabilizar errores de tecleo como intentos fraudulentos en este DEMO.
function normalizePickupClaimDemo(raw) {
 if (typeof raw !== 'string') return null;
 const v=raw.trim().toUpperCase();
 return /^SIM-[A-F0-9]{32}$/.test(v) ? v : null;
}

function verifiedClaimDemoFeedback(response, expectedOrderId) {
 const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
 if (typeof expectedOrderId!=='string'||!uuid.test(expectedOrderId)||
     !response||response.orderId!==expectedOrderId||
     response.cashDisbursed!==false||response.realPaymentsEnabled!==false) {
  return {ok:false,message:'Respuesta del servidor no verificable. Consulta el estado antes de repetir.'};
 }
 return claimDemoFeedback(response);
}
// Cuando la respuesta de crear una solicitud es incierta NO permitir
// generar silenciosamente otra referencia: podría duplicar la orden de prueba.
// El código de retiro es de una sola visualización; un reintento de idéntica
// referencia nunca revela de nuevo el código secreto.
function validatePickupCreateReceiptDemo(response, request) {
 const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
 if(!response||!request||typeof response!=='object'||
    !uuid.test(response.orderId||'')||
    !uuid.test(request.id||'')||
    response.realPaymentsEnabled!==false||
    typeof response.expiresAt!=='string'||
    !Number.isFinite(Date.parse(response.expiresAt))||
    !/^[A-Z]{2}$/.test(request.country||'')||
    !Number.isSafeInteger(request.cents)||
    request.cents<100||request.cents>100000)return null;

 if(response.status==='created'){
   if(response.destinationCountry!==request.country||
      response.amountCents!==request.cents||
      response.isFunded!==false||response.canPayOut!==false||
      !normalizePickupClaimDemo(response.pickupCode)||
      normalizePickupClaimDemo(response.pickupCode)!==response.pickupCode)return null;
   return {status:'created',orderId:response.orderId,pickupCode:response.pickupCode};
 }
 if(response.status==='already_created'&&response.pickupCode===null){
   return {status:'already_created',orderId:response.orderId,pickupCode:null};
 }
 return null;
}
module.exports = { parseDemoAmountCents, normalizeDemoCountry, claimDemoFeedback,
 normalizePickupClaimDemo, verifiedClaimDemoFeedback, validatePickupCreateReceiptDemo };
