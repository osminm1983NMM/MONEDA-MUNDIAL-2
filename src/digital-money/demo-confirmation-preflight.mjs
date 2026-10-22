// Inspección de SOLO DEMO antes de abrir el cuadro de confirmación.
// Consulta el saldo e historial más recientes con la sesión activa.
// No ejecuta una cotización ni convierte monedas por su cuenta.
// La fuente de verdad y la idempotencia siguen en PostgreSQL.
import {parseDemoAssetBalances} from './demo-asset-summary.mjs';
import {validateDemoHistory} from './demo-conversion-contract.mjs';
import {isRecentSameConversionDemo} from './demo-repeat-conversion-warning.mjs';

export async function inspectDemoConfirmationPreflight({
 quote,rpc,isCurrent=()=>true,now=()=>Date.now()
}={}){
 if(!quote||typeof rpc!=='function'||typeof isCurrent!=='function'||
    typeof now!=='function'||typeof quote.quoteId!=='string'||
    !['COIN','STABLE'].includes(quote.fromAsset)||
    !['COIN','STABLE'].includes(quote.toAsset)||
    quote.fromAsset===quote.toAsset||
    !Number.isSafeInteger(quote.amountInMicro)||quote.amountInMicro<=0)
   throw new Error('Cotización de prueba inválida');
 const ensureCurrent=()=>{
   if(!isCurrent())throw new Error('La cuenta o cotización cambió durante la revisión');
 };
 const ensureFresh=()=>{
   if(!Number.isFinite(Date.parse(quote.expiresAt))||
      Date.parse(quote.expiresAt)<=now())
     throw new Error('La cotización venció; solicita otra');
 };
 ensureCurrent();ensureFresh();
 const result=await rpc('mwd_conversion_wallet_demo');
 ensureCurrent();ensureFresh();
 if(!result||result.error)throw new Error('No se pudo consultar el saldo reciente');
 const balances=parseDemoAssetBalances(result.data);
 const history=validateDemoHistory(result.data?.history);
 if(!balances||!history||history.length===20)
   throw new Error('Historial incompleto o no verificable; detener confirmación');
 const balance=quote.fromAsset==='COIN'?balances.coinMicro:balances.stableMicro;
 if(balance<quote.amountInMicro)
   throw new Error('Saldo ficticio insuficiente para esta cotización');
 return {
   balances,history,
   repeated:isRecentSameConversionDemo(quote,history,now()),
   mode:'sandbox_only',realPaymentsEnabled:false
 };
}
