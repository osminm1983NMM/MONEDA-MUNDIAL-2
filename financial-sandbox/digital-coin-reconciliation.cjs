'use strict';
// Independent synthetic custody and reserve comparison. No network, authority,
// attestation, or mutation. The caller must establish a common frozen cut.
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const units=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,23})$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function exact(x,keys){return x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));}
function index(rows,internal=false){
 if(!Array.isArray(rows)||rows.length>10000)fail('INVALID_BALANCE_ROWS');
 const out=new Map();
 for(const row of rows){
  if(!exact(row,internal?['owner','available','reserved']:['owner','totalMinor'])||!id(row.owner))fail('INVALID_BALANCE_ROW');
  const values=internal?[row.available,row.reserved]:[row.totalMinor];
  if(values.some(v=>!units(v)))fail('INVALID_AMOUNT');
  if(out.has(row.owner))fail('DUPLICATE_OWNER');
  out.set(row.owner,values.reduce((s,v)=>s+BigInt(v),0n));
 }
 return out;
}
function compareDigitalCoinCut({environment,cutId,snapshot,reports}={}){
 if(environment!=='sandbox')fail('SANDBOX_ONLY');
 if(!id(cutId))fail('INVALID_CUT');
 const m=snapshot?.manifest,p=snapshot?.projection;
 if(m?.format!=='synthetic-digital-coin-manifest-v1'||!hash(m.sha256)||p?.mode!=='sandbox'||
 p.digital?.mode!=='sandbox'||p.coin?.mode!=='sandbox'||p.coin?.asset!=='COIN_TEST'||
 ![m.reserveUsdMinor,m.obligationsUsdMinor,m.coinOutstandingMinor,p.digital.outstandingDigitalMinor,p.digital.redemptionPayableUsdMinor].every(units)||
 m.reserveUsdMinor!==p.digital.reserveUsdMinor||m.obligationsUsdMinor!==p.digital.obligationsUsdMinor||
 m.coinOutstandingMinor!==p.coin.outstandingMinor||
 BigInt(m.obligationsUsdMinor)!==BigInt(p.digital.outstandingDigitalMinor)+BigInt(p.digital.redemptionPayableUsdMinor))fail('INVALID_INTERNAL_SNAPSHOT');
 const specs=[
  ['reserve','USD','reserve-bank-fixture'],
  ['digital','DIGITAL_TEST','digital-custody-fixture'],
  ['coin','COIN_TEST','coin-custody-fixture']
 ];
 if(!exact(reports,specs.map(x=>x[0])))fail('INVALID_REPORT_SET');
 const sourceIds=new Set();
 for(const [key,asset,source] of specs){
  const r=reports[key],extra=key==='reserve'?['eligibleMinor']:['balances','outstandingMinor'];
  if(!exact(r,['mode','cutId','scope','source','reportId','asset','complete',...extra])||
   r.mode!=='sandbox'||r.cutId!==cutId||r.scope!=='all-test-accounts'||r.source!==source||r.asset!==asset||
   r.complete!==true||!id(r.reportId)||sourceIds.has(r.reportId))fail('INCOMPLETE_OR_MISMATCHED_REPORT');
  sourceIds.add(r.reportId);
 }
 if(!units(reports.reserve.eligibleMinor)||!units(reports.digital.outstandingMinor)||!units(reports.coin.outstandingMinor))fail('INVALID_AMOUNT');
 const issues=[];
 const mismatch=(code,asset,internal,external,owner)=>{
  issues.push({code,asset,...(owner===undefined?{}:{owner}),internalMinor:String(internal),externalMinor:String(external)});
 };
 const reserve=BigInt(reports.reserve.eligibleMinor),obligations=BigInt(m.obligationsUsdMinor);
 if(reserve!==BigInt(m.reserveUsdMinor))mismatch('RESERVE_MISMATCH','USD',m.reserveUsdMinor,reserve);
 if(reserve<obligations)mismatch('INSUFFICIENT_COVERAGE','USD',obligations,reserve);
 if(BigInt(m.reserveUsdMinor)<obligations)mismatch('BOOK_COVERAGE_DEFICIT','USD',obligations,m.reserveUsdMinor);
 for(const [key,asset,expected] of [
  ['digital','DIGITAL_TEST',p.digital.outstandingDigitalMinor],
  ['coin','COIN_TEST',p.coin.outstandingMinor]
 ]){
  const internal=index(p[key].accounts,true),external=index(reports[key].balances);
  const sum=map=>[...map.values()].reduce((s,v)=>s+v,0n);
  if(sum(internal)!==BigInt(expected))fail('INVALID_INTERNAL_SNAPSHOT');
  const declared=BigInt(reports[key].outstandingMinor);
  if(sum(external)!==declared)mismatch('CUSTODY_TOTAL_MISMATCH',asset,declared,sum(external));
  if(BigInt(expected)!==declared)mismatch('SUPPLY_MISMATCH',asset,expected,declared);
  for(const owner of [...new Set([...internal.keys(),...external.keys()])].sort()){
   const a=internal.get(owner)||0n,b=external.get(owner)||0n;
   if(a!==b)mismatch(!external.has(owner)?'MISSING_CUSTODY_BALANCE':!internal.has(owner)?'UNKNOWN_CUSTODY_BALANCE':'OWNER_BALANCE_MISMATCH',asset,a,b,owner);
  }
 }
 return {mode:'sandbox',cutId,internalSha256:m.sha256,reportIds:[...sourceIds],clean:issues.length===0,issues};
}
module.exports={compareDigitalCoinCut};
