'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assembleStatementPages}=require('../../financial-sandbox/statement-pages.cjs');
function exercise(assemble,assert){
  const row=n=>({mode:'sandbox',reference:'ref'+n,kind:'funding',currency:'USD',amountMinor:100,status:'confirmed'});
  const base={mode:'sandbox',source:'provider',snapshotId:'snapshot-1',scope:'US-HN:all-funding-payout-refund',start:'2026-11-26T00:00:00.000Z',end:'2026-11-27T00:00:00.000Z',capturedAt:'2026-11-27T00:01:00.000Z',declaredCount:2,pageCount:2};
  const pages=()=>[{...base,index:0,cursor:null,nextCursor:'next-a',complete:false,rows:[row(1)]},{...base,index:1,cursor:'next-a',nextCursor:null,complete:true,rows:[row(2)]}];
  const run=p=>assemble({environment:'sandbox',pages:p});
  assert.equal(run(pages()).rows.length,2);
  const empty={...base,declaredCount:0,pageCount:1,index:0,cursor:null,nextCursor:null,complete:true,rows:[]};
  assert.equal(run([empty]).rows.length,0);
  const cases=[
    [p=>p.pop(),'INVALID_ENVELOPE'],
    [p=>p.reverse(),'INVALID_PAGE'],
    [p=>p[1].snapshotId='different','PAGE_ENVELOPE_MISMATCH'],
    [p=>p[1].capturedAt='2026-11-27T00:02:00.000Z','PAGE_ENVELOPE_MISMATCH'],
    [p=>p[1].cursor='wrong','INVALID_PAGE'],
    [p=>p[1].nextCursor='next-a','INVALID_CURSOR_CHAIN'],
    [p=>p[0].complete=true,'INVALID_PAGE'],
    [p=>p[1].rows=[row(1)],'DUPLICATE_REFERENCE'],
    [p=>p[1].rows=[{...row(2),amountMinor:1.5}],'INVALID_ROW'],
    [p=>p.forEach(x=>x.declaredCount=3),'COUNT_MISMATCH'],
    [p=>p.forEach(x=>x.declaredCount=1),'COUNT_MISMATCH'],
    [p=>p[1].rows=[],'INVALID_PAGE']
  ];
  for(const [change,error] of cases){const p=pages();change(p);assert.throws(()=>run(p),new RegExp(error));}
  assert.throws(()=>assemble({environment:'production',pages:pages()}),/SANDBOX_ONLY/);
  const large=Array.from({length:10001},(_,i)=>row(i));
  const p=pages().map(x=>({...x,declaredCount:large.length}));
  p[0].rows=large.slice(0,10000);p[1].rows=large.slice(10000);
  assert.equal(run(p).rows.length,10001);
  const extra=pages();extra[0].rows[0].secret='not copied';assert.equal('secret' in run(extra).rows[0],false);
}
test('synthetic paginated statement contract fails closed and handles more than 10000 rows',()=>exercise(assembleStatementPages,assert));
