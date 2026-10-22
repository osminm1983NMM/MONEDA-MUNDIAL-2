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
module.exports = { parseDemoAmountCents, normalizeDemoCountry, claimDemoFeedback,
 normalizePickupClaimDemo, verifiedClaimDemoFeedback };
