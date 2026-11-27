'use strict';
// Shared, portable sandbox status response contract.
const states=new Set(['funding_pending','funding_failed','funded','payout_pending','payout_failed','paid','refund_pending','refunded']);
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const amount=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(x)&&BigInt(x)<=9223372036854775807n;
function validOrderStatus(x,id){
 if(!exact(x,['mode','orderId','status','source','destination','acceptedAt'])||x.mode!=='sandbox'||x.orderId!==id||!states.has(x.status)||
 !exact(x.source,['currency','principalMinor','feeMinor','totalMinor'])||x.source.currency!=='USD'||
 !exact(x.destination,['currency','amountMinor'])||x.destination.currency!=='HNL')return false;
 const {principalMinor:p,feeMinor:f,totalMinor:t}=x.source,d=x.destination.amountMinor;
 if(![p,f,t,d].every(amount)||p==='0'||d==='0'||BigInt(p)+BigInt(f)!==BigInt(t))return false;
 if(typeof x.acceptedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x.acceptedAt))return false;
 const date=new Date(x.acceptedAt);
 return Number.isFinite(date.getTime())&&date.toISOString()===x.acceptedAt;
}
module.exports={validOrderStatus};
