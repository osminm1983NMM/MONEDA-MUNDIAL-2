'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),http=require('node:http');
const {createOrderStatusLoopback}=require('../../financial-sandbox/order-status-loopback.cjs');
const {route}=require('../../financial-sandbox/order-status-http.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const publicStatus={mode:'sandbox',orderId,status:'funding_pending',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
const options={method:'POST',headers:{authorization:'Bearer fixture-token','content-type':'application/json'},body:JSON.stringify({orderId})};
async function fixture(t,extra={}){
 const calls=[];
 const listener=createOrderStatusLoopback({environment:'sandbox',service:{async read(value){calls.push(value);return {status:200,body:publicStatus};}},...extra});
 t.after(()=>listener.close());return {base:await listener.start(),calls};
}
test('real TCP loopback serves only the authenticated sandbox query',async t=>{
 const {base,calls}=await fixture(t);
 a.equal(new URL(base).hostname,'127.0.0.1');
 const r=await fetch(base+route,options);
 a.equal(r.status,200);a.equal(r.headers.get('cache-control'),'no-store');
 a.deepEqual(await r.json(),publicStatus);
 a.deepEqual(calls,[{sessionToken:'fixture-token',orderId}]);
 a.equal((await fetch(base+route+'?actor=other',options)).status,400);
 a.equal((await fetch(base+'/other',options)).status,404);
 a.equal((await fetch(base+route)).status,405);
 a.equal((await fetch(base+route,{...options,headers:{'content-type':'application/json'}})).status,401);
 a.equal(calls.length,1);
});
test('wire transport rejects oversized input and recovers after a stalled upload',{timeout:5000},async t=>{
 const {base,calls}=await fixture(t,{bodyTimeoutMs:100});
 a.equal((await fetch(base+route,{...options,body:'x'.repeat(1025)})).status,413);
 const status=await new Promise((resolve,reject)=>{
  const req=http.request(base+route,{method:'POST',headers:{...options.headers,'content-length':100}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.write('{'); // deliberately incomplete body
 });
 a.equal(status,408);a.equal(calls.length,0);
 a.equal((await fetch(base+route,options)).status,200);
});
test('duplicate authorization headers are rejected before the service',{timeout:5000},async t=>{
 const {base,calls}=await fixture(t);
 const status=await new Promise((resolve,reject)=>{
  const req=http.request(base+route,{method:'POST',headers:{authorization:['Bearer first','Bearer second'],'content-type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.end(options.body);
 });
 a.equal(status,400);a.equal(calls.length,0);
});
test('listener requires sandbox mode and bounded configuration',()=>{
 a.throws(()=>createOrderStatusLoopback({environment:'production',service:{read(){}}}),/SANDBOX_ONLY/);
 a.throws(()=>createOrderStatusLoopback({environment:'sandbox',service:{read(){}},maxConnections:0}),/INVALID_CONNECTION_LIMIT/);
});

test('wire transport rejects foreign HTTP authority and browser origin',{timeout:5000},async t=>{
 const {base,calls}=await fixture(t);
 const send=headers=>new Promise((resolve,reject)=>{
  const req=http.request(base+route,{method:'POST',headers:{...options.headers,...headers}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.end(options.body);
 });
 a.equal(await send({host:'untrusted.example'}),400);
 a.equal(await send({host:'127.0.0.1:1'}),400);
 a.equal(await send({origin:'https://untrusted.example'}),403);
 a.equal(await send({origin:'null'}),403);
 a.equal(calls.length,0);
 a.equal(await send({origin:base}),200);
 a.equal(await send({}),200);
 a.equal(calls.length,2);
});

test('TCP transport through actual status service binds orders to authenticated actors',{timeout:5000},async t=>{
 const {createOrderStatusService}=require('../../financial-sandbox/order-status-service.cjs');
 const calls=[];
 const row={order_id:orderId,status:'paid',principal_minor:'9007199254740993',fee_minor:'1',total_minor:'9007199254740994',source_currency:'USD',payout_minor:'250000',payout_currency:'HNL',accepted_at:'2026-11-26T15:00:00.000Z'};
 const service=createOrderStatusService({environment:'sandbox',
  verifySession:async token=>token==='owner-token'?{environment:'sandbox',actor:'owner'}:token==='other-token'?{environment:'sandbox',actor:'other'}:null,
  query:async(sql,params)=>{calls.push(params);return {rows:params[0]==='owner'&&params[1]===orderId?[row]:[]};}});
 const listener=createOrderStatusLoopback({environment:'sandbox',service});
 t.after(()=>listener.close());
 const base=await listener.start();
 const send=(token,id=orderId)=>fetch(base+route,{...options,headers:{...options.headers,authorization:'Bearer '+token},body:JSON.stringify({orderId:id})});
 const owner=await send('owner-token');a.equal(owner.status,200);
 a.equal((await owner.json()).source.totalMinor,'9007199254740994');
 const other=await send('other-token');const absent=await send('owner-token','00000000-0000-4000-8000-000000000002');
 a.equal(other.status,404);a.equal(absent.status,404);a.deepEqual(await other.json(),await absent.json());
 a.equal((await send('unknown-token')).status,401);
 a.deepEqual(calls,[['owner',orderId],['other',orderId],['owner','00000000-0000-4000-8000-000000000002']]);
});
