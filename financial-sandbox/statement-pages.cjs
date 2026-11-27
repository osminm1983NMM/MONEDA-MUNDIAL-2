'use strict';
// Offline synthetic pagination contract. No provider requests or authorization.
function assembleStatementPages({environment,pages}={}) {
  const fail=code=>{throw Object.assign(Error(code),{code});};
  const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
  const token=v=>typeof v==='string'&&v.length>=1&&v.length<=256;
  const time=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
  if(environment!=='sandbox')fail('SANDBOX_ONLY');
  if(!Array.isArray(pages)||pages.length<1||pages.length>1000)fail('INVALID_PAGES');
  const first=pages[0];
  if(!first||first.mode!=='sandbox'||!['internal','provider'].includes(first.source)||!id(first.snapshotId)||first.scope!=='US-HN:all-funding-payout-refund'||!time(first.start)||!time(first.end)||!time(first.capturedAt)||first.start>=first.end||first.capturedAt<first.end||!Number.isSafeInteger(first.declaredCount)||first.declaredCount<0||first.declaredCount>100000||first.pageCount!==pages.length)fail('INVALID_ENVELOPE');
  const keys=['mode','source','snapshotId','scope','start','end','capturedAt','declaredCount','pageCount'];
  const rows=[], refs=new Set(), tokens=new Set();
  let expected=null;
  for(let i=0;i<pages.length;i++){
    const p=pages[i],last=i===pages.length-1;
    if(!p||keys.some(k=>p[k]!==first[k]))fail('PAGE_ENVELOPE_MISMATCH');
    if(p.index!==i||p.cursor!==expected||p.complete!==last||!Array.isArray(p.rows)||p.rows.length>10000||(!p.rows.length&&!(pages.length===1&&first.declaredCount===0)))fail('INVALID_PAGE');
    if(last?p.nextCursor!==null:!token(p.nextCursor)||tokens.has(p.nextCursor))fail('INVALID_CURSOR_CHAIN');
    if(!last)tokens.add(p.nextCursor);
    expected=p.nextCursor;
    for(const r of p.rows){
      if(!r||r.mode!=='sandbox'||!id(r.reference)||!['funding','payout','refund'].includes(r.kind)||!['pending','confirmed','failed'].includes(r.status)||r.currency!==(r.kind==='payout'?'HNL':'USD')||!Number.isSafeInteger(r.amountMinor)||r.amountMinor<=0)fail('INVALID_ROW');
      if(refs.has(r.reference))fail('DUPLICATE_REFERENCE');
      refs.add(r.reference);
      rows.push({mode:r.mode,reference:r.reference,kind:r.kind,currency:r.currency,amountMinor:r.amountMinor,status:r.status});
      if(rows.length>first.declaredCount)fail('COUNT_MISMATCH');
    }
  }
  if(rows.length!==first.declaredCount)fail('COUNT_MISMATCH');
  return {mode:'sandbox',source:first.source,snapshotId:first.snapshotId,scope:first.scope,complete:true,start:first.start,end:first.end,capturedAt:first.capturedAt,declaredCount:first.declaredCount,rows};
}
module.exports={assembleStatementPages};
