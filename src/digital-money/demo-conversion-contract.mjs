// Solo simulador. Estas verificaciones no sustituyen permisos y libros contables del servidor.
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
const micro=x=>{const n=typeof x==='number'?x:typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)?Number(x):NaN;return Number.isSafeInteger(n)&&n>=0?n:null;};
const other=x=>x==='COIN'?'STABLE':x==='STABLE'?'COIN':null;
export function validateDemoQuote(x,asset,amount,now=Date.now()){
 if(!x||x.realPaymentsEnabled!==false||x.priceIsReal!==false||
    x.provider!=='synthetic_sandbox'||x.status!=='quoted'||!uuid(x.quoteId)||
    !other(asset)||x.fromAsset!==asset||x.toAsset!==other(asset))return null;
 const incoming=micro(x.amountInMicro),gross=micro(x.grossOutMicro),fee=micro(x.feeOutMicro),net=micro(x.amountOutMicro);
 if(incoming!==amount||gross===null||fee===null||net===null||net<=0||gross!==fee+net)return null;
 const rate=String(x.stablePerCoin??'');
 if(!/^\d+(?:\.\d{1,8})?$/.test(rate)||!(Number(rate)>0)||!Number.isFinite(Number(rate)))return null;
 if(typeof x.expiresAt!=='string'||!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(x.expiresAt))return null;
 const expiry=Date.parse(x.expiresAt);
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+130000)return null;
 return {...x,amountInMicro:incoming,grossOutMicro:gross,feeOutMicro:fee,amountOutMicro:net,stablePerCoin:rate};
}
export function validateDemoReceipt(x,quote){
 if(!x||!quote||x.realPaymentsEnabled!==false||!uuid(x.conversionId)||
    x.quoteId!==quote.quoteId)return false;
 // Respuesta idempotente: el servidor no repite importes; solo comunica el recibo.
 if(x.status==='already_processed')return true;
 if(x.status!=='ok'||x.fromAsset!==quote.fromAsset||x.toAsset!==quote.toAsset)return false;
 return micro(x.amountInMicro)===quote.amountInMicro &&
   micro(x.amountOutMicro)===quote.amountOutMicro &&
   micro(x.feeOutMicro)===quote.feeOutMicro;
}
export function validateDemoHistory(x){
 if(!Array.isArray(x)||x.length>20)return null;
 const out=[];
 for(const item of x){
  if(!item||!uuid(item.id)||item.toAsset!==other(item.fromAsset)||
     typeof item.settledAt!=='string'||!Number.isFinite(Date.parse(item.settledAt)))return null;
  const a=micro(item.amountInMicro),b=micro(item.amountOutMicro),fee=micro(item.feeOutMicro);
  const price=String(item.priceSnapshot??'');
  if(a===null||b===null||a===0||b===0||fee===null||
     !/^\d+(?:\.\d{1,8})?$/.test(price)||!(Number(price)>0)||
     !Number.isFinite(Number(price)))return null;
  out.push({...item,amountInMicro:a,amountOutMicro:b,feeOutMicro:fee,priceSnapshot:price});
 }
 return out;
}
