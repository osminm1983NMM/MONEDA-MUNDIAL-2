// Solo simulador. Estas verificaciones no sustituyen permisos y libros contables del servidor.
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const micro=x=>{const n=typeof x==='number'?x:typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)?Number(x):NaN;return Number.isSafeInteger(n)&&n>=0?n:null;};
const other=x=>x==='COIN'?'STABLE':x==='STABLE'?'COIN':null;
function expectedGrossMicro(incoming,asset,rate){
 const [whole,fraction='']=rate.split('.');
 const denominator=10n**BigInt(fraction.length);
 const numerator=BigInt(whole)*denominator+BigInt(fraction||'0');
 if(numerator<=0n)return null;
 return asset==='COIN' ? BigInt(incoming)*numerator/denominator
   : asset==='STABLE' ? BigInt(incoming)*denominator/numerator : null;
}
export function validateDemoQuote(x,asset,amount,now=Date.now()){
 if(!x||x.realPaymentsEnabled!==false||x.priceIsReal!==false||
    x.provider!=='synthetic_sandbox'||x.status!=='quoted'||!uuid(x.quoteId)||
    !other(asset)||x.fromAsset!==asset||x.toAsset!==other(asset))return null;
 const incoming=micro(x.amountInMicro),gross=micro(x.grossOutMicro),fee=micro(x.feeOutMicro),net=micro(x.amountOutMicro);
 if(incoming!==amount||gross===null||fee===null||net===null||net<=0||gross!==fee+net)return null;
 const rate=String(x.stablePerCoin??'');
 if(!/^\d+(?:\.\d{1,8})?$/.test(rate)||!(Number(rate)>0)||!Number.isFinite(Number(rate)))return null;
 // No aceptar importes que contradigan la tasa sintética declarada.
 if(BigInt(gross)!==expectedGrossMicro(incoming,asset,rate))return null;
 if(typeof x.expiresAt!=='string'||!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(x.expiresAt))return null;
 const expiry=Date.parse(x.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+130000)return null;
 return {...x,amountInMicro:incoming,grossOutMicro:gross,feeOutMicro:fee,amountOutMicro:net,stablePerCoin:rate};
}
export function validateDemoReceipt(x,quote){
 if(!x||!quote||x.realPaymentsEnabled!==false||!uuid(x.conversionId)||
    x.quoteId!==quote.quoteId)return false;
 // Respuesta idempotente: el servidor no repite importes; solo comunica el recibo.
 if(x.status==='already_processed'){
  // La RPC actual solo retorna identificadores; si futuras versiones agregan
  // montos o monedas, no aceptar campos contradictorios aunque sea un reintento.
  if(x.mode!==undefined&&x.mode!=='sandbox_only')return false;
  for(const field of ['fromAsset','toAsset']){
   if(Object.prototype.hasOwnProperty.call(x,field)&&x[field]!==quote[field])return false;
  }
  for(const field of ['amountInMicro','amountOutMicro','feeOutMicro']){
   if(Object.prototype.hasOwnProperty.call(x,field)&&micro(x[field])!==quote[field])return false;
  }
  return true;
 }
 if(x.status!=='ok'||x.fromAsset!==quote.fromAsset||x.toAsset!==quote.toAsset)return false;
 return micro(x.amountInMicro)===quote.amountInMicro &&
   micro(x.amountOutMicro)===quote.amountOutMicro &&
   micro(x.feeOutMicro)===quote.feeOutMicro;
}
export function validateDemoHistory(x){
 if(!Array.isArray(x)||x.length>20)return null;
 const out=[];
 const ids=new Set();
 for(const item of x){
  if(!item||!uuid(item.id)||ids.has(item.id.toLowerCase())||
     item.toAsset!==other(item.fromAsset)||
     typeof item.settledAt!=='string'||
     !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(item.settledAt)||
     !Number.isFinite(Date.parse(item.settledAt)))return null;
  ids.add(item.id.toLowerCase());
  const a=micro(item.amountInMicro),b=micro(item.amountOutMicro),fee=micro(item.feeOutMicro);
  const price=String(item.priceSnapshot??'');
  if(a===null||b===null||a===0||b===0||fee===null||
     !/^\d+(?:\.\d{1,8})?$/.test(price)||!(Number(price)>0)||
     !Number.isFinite(Number(price))||
     BigInt(b)+BigInt(fee)!==expectedGrossMicro(a,item.fromAsset,price))return null;
  out.push({...item,amountInMicro:a,amountOutMicro:b,feeOutMicro:fee,priceSnapshot:price});
 }
 return out;
}
