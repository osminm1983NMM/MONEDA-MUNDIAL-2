// Alerta de uso SOLO DEMO: repetir una intención con un nuevo quoteId
// no es el mismo reintento idempotente. No cambia saldos ni altera la base.
// Advertencia UX; seguridad e idempotencia reales dependen del servidor.
const WINDOW_MS=10*60*1000;

export function isRecentSameConversionDemo(quote,history,now=Date.now()){
 if(!quote||!Array.isArray(history)||!Number.isFinite(now)||
    !['COIN','STABLE'].includes(quote.fromAsset)||
    !['COIN','STABLE'].includes(quote.toAsset)||
    quote.toAsset===quote.fromAsset||
    !Number.isSafeInteger(quote.amountInMicro)||quote.amountInMicro<=0)return false;

 return history.some(entry=>{
  if(!entry||entry.fromAsset!==quote.fromAsset||entry.toAsset!==quote.toAsset||
      entry.amountInMicro!==quote.amountInMicro)return false;
  const at=Date.parse(entry.settledAt);
  // Ignorar marcas inválidas o demasiado futuras (reloj local incorrecto).
  return Number.isFinite(at)&&at>=now-WINDOW_MS&&at<=now+30*1000;
 });
}
