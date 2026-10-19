// Verificación reforzada SOLO DEMO: una respuesta a "confirmar" no basta
// para liberar una operación pendiente tras un corte de conexión.
// No envía pagos ni criptoactivos reales; el servidor aplica idempotencia por quoteId.
import {validateDemoReceipt} from './demo-conversion-contract.mjs';
import {classifyDemoReconciliation, encodePendingDemoQuote} from './demo-pending-confirmation.mjs';

export async function confirmAndReconcileDemo({quote,rpc,isCurrent=()=>true}) {
  if (!encodePendingDemoQuote(quote) || typeof rpc!=='function' || typeof isCurrent!=='function')
    throw new Error('Confirmación de prueba inválida');
  const assertCurrent=()=>{
    if(!isCurrent())throw new Error('La sesión o pantalla cambió; se conserva la confirmación pendiente');
  };
  assertCurrent();
  // Una sola confirmación de la MISMA cotización, sin solicitar otra referencia.
  const confirmed=await rpc('mwd_conversion_confirm_demo',{p_quote_id:quote.quoteId});
  assertCurrent();
  if(confirmed?.error)throw confirmed.error;
  if(!validateDemoReceipt(confirmed?.data,quote))
    throw new Error('Recibo ficticio no verificable');
  // Antes de quitar la operación pendiente, consultar el asiento confirmado.
  // Si la red falla aquí, el llamador DEBE conservar su registro local.
  const reconciled=await rpc('mwd_conversion_reconcile_demo',{p_quote_id:quote.quoteId});
  assertCurrent();
  if(reconciled?.error)throw reconciled.error;
  if(classifyDemoReconciliation(reconciled?.data,quote)!=='executed' ||
     reconciled.data.conversionId!==confirmed.data.conversionId)
    throw new Error('Recibo y conciliación ficticios no coinciden');
  return {status:'executed',conversionId:confirmed.data.conversionId};
}
