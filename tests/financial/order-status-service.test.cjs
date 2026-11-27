'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createOrderStatusService:create}=require('../../financial-sandbox/order-status-service.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const request={sessionToken:'opaque-fixture',orderId};
const row={order_id:orderId,status:'funding_pending',principal_minor:'10000',fee_minor:'150',total_minor:'10150',source_currency:'USD',payout_minor:'250000',payout_currency:'HNL',accepted_at:'2026-11-26T15:00:00.000Z'};
function fixture({session={environment:'sandbox',actor:'fixture-owner'},rows=[row],verify,db}={}){
 const calls=[];
 const service=create({environment:'sandbox',verifySession:verify??(async token=>{a.equal(token,request.sessionToken);return session;}),
 query:async(sql,params)=>{calls.push({sql,params});return db?db():{rows};}});
 return {service,calls};
}
test('status uses verified actor and a bound SQL query, returns only public sandbox fields',async()=>{
 const f=fixture(),r=await f.service.read(request);
 a.equal(r.status,200);a.deepEqual(f.calls[0].params,['fixture-owner',orderId]);
 a.match(f.calls[0].sql,/read_bound_order_status\(\$1::text,\$2::uuid\)/);
 a.ok(!f.calls[0].sql.includes('fixture-owner'));a.ok(!f.calls[0].sql.includes(orderId));
 a.deepEqual(r.body,{mode:'sandbox',orderId,status:'funding_pending',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:row.accepted_at});
});
test('missing, rejected or cross-environment session and spoofed actor never reach SQL',async()=>{
 for(const session of [null,{environment:'production',actor:'fixture-owner'},{environment:'sandbox',actor:'x y'},{environment:'sandbox',actor:'fixture-owner',extra:true}]){
  const f=fixture({session});a.equal((await f.service.read(request)).status,401);a.equal(f.calls.length,0);
 }
 const f=fixture();
 a.equal((await f.service.read({...request,actor:'victim'})).status,400);
 a.equal((await f.service.read({...request,sessionToken:''})).status,401);
 a.equal((await f.service.read({...request,orderId:"' OR 1=1"})).status,400);
 a.equal(f.calls.length,0);
 a.throws(()=>create({environment:'production',verifySession:()=>{},query:()=>{}}),/SANDBOX_ONLY/);
});
test('empty result has one indistinguishable not-found response; no internal errors escape',async()=>{
 const f=fixture({rows:[]});a.deepEqual(await f.service.read(request),{status:404,body:{mode:'sandbox',error:'NOT_FOUND'}});
 const db=fixture({db:()=>{throw Error('private database detail');}});
 const auth=fixture({verify:()=>{throw Error('private identity detail');}});
 for(const x of [db,auth])a.deepEqual(await x.service.read(request),{status:503,body:{mode:'sandbox',error:'UNAVAILABLE'}});
 a.equal(auth.calls.length,0);
});
test('bad projection, extra columns, invalid timestamp and unsafe numeric values fail closed',async()=>{
 for(const patch of [{order_id:'another'},{status:'unknown'},{principal_minor:10000},{total_minor:'10151'},{payout_currency:'USD'},{accepted_at:'2026-02-30T15:00:00.000Z'},{provider_secret:'never expose'},{payout_minor:'9223372036854775808'}]){
  const f=fixture({rows:[{...row,...patch}]});
  a.deepEqual(await f.service.read(request),{status:503,body:{mode:'sandbox',error:'UNAVAILABLE'}});
 }
 a.equal((await fixture({rows:[row,row]}).service.read(request)).status,503);
 const large={...row,principal_minor:'9007199254740993',fee_minor:'1',total_minor:'9007199254740994'};
 a.equal((await fixture({rows:[large]}).service.read(request)).body.source.principalMinor,'9007199254740993');
});

test('malformed request never reaches identity verifier or database',async()=>{
 let authCalls=0;
 const f=fixture({verify:async()=>{authCalls++;return {environment:'sandbox',actor:'fixture-owner'};}});
 for(const token of ['','bad token','bad\u0000token','bad/token','bad+token','é','a'.repeat(8193),null,123])
  a.equal((await f.service.read({...request,sessionToken:token})).status,401);
 for(const id of ['invalid',orderId.toUpperCase().replace('0','A'),null,123])
  a.equal((await f.service.read({...request,orderId:id})).status,400);
 a.equal(authCalls,0);a.equal(f.calls.length,0);
 a.equal((await f.service.read(request)).status,200);a.equal(authCalls,1);
});
test('database projection uses shared contract without coercing values',async()=>{
 for(const patch of [{fee_minor:'00'},{principal_minor:'0',total_minor:'150'},{payout_minor:'0'},{accepted_at:'2026-11-26'},{source_currency:'HNL'}]){
  const f=fixture({rows:[{...row,...patch}]});
  a.deepEqual(await f.service.read(request),{status:503,body:{mode:'sandbox',error:'UNAVAILABLE'}});
 }
});

test('cancelled service does not start identity or SQL and rejects a late database result',async()=>{
 let verified=0;
 const pre=fixture({verify:async()=>{verified++;return {environment:'sandbox',actor:'fixture-owner'};}});
 const ctrl=new AbortController();ctrl.abort();
 a.equal((await pre.service.read(request,ctrl.signal)).status,503);
 a.equal(verified,0);a.equal(pre.calls.length,0);
 const mid=new AbortController();
 const f=fixture({verify:async()=>{mid.abort();return {environment:'sandbox',actor:'fixture-owner'};}});
 a.equal((await f.service.read(request,mid.signal)).status,503);a.equal(f.calls.length,0);
 const late=new AbortController();
 const g=fixture({db:()=>{late.abort();return {rows:[row]};}});
 a.equal((await g.service.read(request,late.signal)).status,503);a.equal(g.calls.length,1);
});
