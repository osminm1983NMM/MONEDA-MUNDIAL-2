// Recuperación de conversiones DEMO después de una respuesta de red incierta.
// No crea ni confirma nuevas conversiones; solo consulta el resultado en Supabase.
export async function reconcileSwapQuote(supabase, quoteId) {
  if (!quoteId) throw new Error('Falta el identificador de la cotización.');
  const { data, error } = await supabase.rpc('mwd_conversion_reconcile_demo', {
    p_quote_id: quoteId,
  });
  if (error) throw error;
  if (!data || data.realPaymentsEnabled !== false) {
    throw new Error('Respuesta de conciliación no válida para demostración.');
  }
  if (data.quoteId !== quoteId) {
    throw new Error('La conciliación devolvió una cotización diferente.');
  }
  if (!['executed', 'quoted', 'expired'].includes(data.status)) {
    throw new Error('Estado de conciliación desconocido.');
  }
  if (data.status === 'executed' && !data.conversionId) {
    throw new Error('Conversión ejecutada sin comprobante.');
  }
  return data;
}

// Solo debe ofrecerse un reintento de confirmación si el servidor indica
// expresamente que la cotización aún está vigente y sin ejecutar.
export function swapRecoveryAction(status) {
  if (status === 'executed') return 'refresh_wallet';
  if (status === 'expired') return 'request_new_quote';
  if (status === 'quoted') return 'retry_same_quote';
  return 'manual_review';
}
