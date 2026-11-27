'use strict';
// Portable exact response schema shared by server and client.
function validPortfolio(x){
 const exact=(v,ks)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
 const units=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,24})$/.test(v);
 if(!exact(x,['mode','assets','pendingRedemptionUsdMinor','conversions'])||x.mode!=='sandbox'||!units(x.pendingRedemptionUsdMinor)||!Array.isArray(x.assets)||x.assets.length!==2||!Array.isArray(x.conversions)||x.conversions.length>2000)return false;
 for(const [i,asset] of ['DIGITAL_TEST','COIN_TEST'].entries()){
  const b=x.assets[i];
  if(!exact(b,['asset','availableMinor','reservedMinor','totalMinor'])||b.asset!==asset||![b.availableMinor,b.reservedMinor,b.totalMinor].every(units)||BigInt(b.availableMinor)+BigInt(b.reservedMinor)!==BigInt(b.totalMinor))return false;
 }
 const seen=new Set();
 for(const q of x.conversions){
  if(!exact(q,['quoteId','direction','digitalMinor','coinMinor','state','expiresAt'])||typeof q.quoteId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(q.quoteId)||seen.has(q.quoteId)||!['digital_to_coin','coin_to_digital'].includes(q.direction)||!['quoted','reserved','confirmed','cancelled'].includes(q.state)||![q.digitalMinor,q.coinMinor].every(units)||q.digitalMinor==='0'||q.coinMinor==='0'||!Number.isSafeInteger(q.expiresAt)||q.expiresAt<0)return false;
  seen.add(q.quoteId);
 }
 return true;
}
module.exports={validPortfolio};
