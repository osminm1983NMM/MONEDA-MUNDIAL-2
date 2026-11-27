'use strict';
// Internal read-only portfolio projection. No HTTP endpoint, identity verification,
// live assets, pricing, or custody. Trusted caller must supply verified actor.
function readDigitalCoinPortfolio({environment,ledger,verifiedActor}={}){
 const fail=code=>{throw Object.assign(Error(code),{code});};
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 // verifiedActor is supplied by a trusted server adapter, never by request body.
 if(typeof verifiedActor!=='string'||! /^[A-Za-z0-9_-]{1,80}$/.test(verifiedActor)||verifiedActor==='treasury')fail('AUTH_REQUIRED');
 if(!ledger||typeof ledger.reconciliationSnapshot!=='function')fail('INVALID_LEDGER');
 const {manifest,projection:p}=ledger.reconciliationSnapshot();
 if(manifest?.format!=='synthetic-digital-coin-manifest-v1'||p?.mode!=='sandbox'||p.digital?.mode!=='sandbox'||p.coin?.mode!=='sandbox'||p.coin.asset!=='COIN_TEST')fail('INVALID_SNAPSHOT');
 const units=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,23})$/.test(v);
 const balance=(rows,asset)=>{
  if(!Array.isArray(rows)||rows.length>10000)fail('INVALID_SNAPSHOT');
  const own=rows.filter(x=>x?.owner===verifiedActor);
  if(own.length>1)fail('INVALID_SNAPSHOT');
  const b=own[0]??{available:'0',reserved:'0'};
  if(!units(b.available)||!units(b.reserved))fail('INVALID_SNAPSHOT');
  return {asset,availableMinor:b.available,reservedMinor:b.reserved,totalMinor:String(BigInt(b.available)+BigInt(b.reserved))};
 };
 const digital=balance(p.digital.accounts,'DIGITAL_TEST'),coin=balance(p.coin.accounts,'COIN_TEST');
 if(!Array.isArray(p.quotes)||p.quotes.length>2000||!Array.isArray(p.digital.redemptions)||p.digital.redemptions.length>10000)fail('INVALID_SNAPSHOT');
 const conversions=p.quotes.filter(q=>q?.owner===verifiedActor).map(q=>{
  if(typeof q.quoteId!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(q.quoteId)||!['digital_to_coin','coin_to_digital'].includes(q.direction)||!['quoted','reserved','confirmed','cancelled'].includes(q.state)||!units(q.digitalMinor)||!units(q.coinMinor)||!Number.isSafeInteger(q.expiresAt)||q.expiresAt<0)fail('INVALID_SNAPSHOT');
  return {quoteId:q.quoteId,direction:q.direction,digitalMinor:q.digitalMinor,coinMinor:q.coinMinor,state:q.state,expiresAt:q.expiresAt};
 });
 let pending=0n;
 for(const x of p.digital.redemptions.filter(x=>x?.owner===verifiedActor&&x.state==='awaiting_payout')){
  if(!units(x.amountMinor))fail('INVALID_SNAPSHOT');pending+=BigInt(x.amountMinor);
 }
 return {mode:'sandbox',assets:[digital,coin],pendingRedemptionUsdMinor:String(pending),conversions};
}
module.exports={readDigitalCoinPortfolio};
