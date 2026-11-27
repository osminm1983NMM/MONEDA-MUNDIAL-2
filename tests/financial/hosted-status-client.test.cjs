'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createOrderStatusClient}=require('../../financial-sandbox/order-status-client.cjs');
const {createRemittanceStatusHost}=require('../../financial-sandbox/mobile/remittance-status-host.js');
const origin='https://tfamyuqqpenilnovqjpp.supabase.co',key='sb_publishable_fixture_only_123456789';
const orderId='00000000-0000-4000-8000-000000000081';
const token=(issuer=origin+'/auth/v1',role='authenticated',anon=false)=>'e30.'+Buffer.from(JSON.stringify({iss:issuer,role,is_anonymous:anon,metadata:'Prueba ñ'})).toString('base64url')+'.fixture';
const value={mode:'sandbox',orderId,status:'funding_pending',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-27T14:00:00.000Z'};
const response=body=>new Response(body,{status:200,headers:{'content-type':'application/json'}});
const client=fetchImpl=>createOrderStatusClient({environment:'sandbox',sandboxOrigin:origin,transport:'hosted-rpc',publishableKey:key,fetchImpl});
test('hosted RPC uses only fixed lab origin, public key and user token',async()=>{
 const t=token();let calls=0;
 const c=client(async(url,req)=>{calls++;assert.equal(url,origin+'/rest/v1/rpc/mwd_lab_read_status');assert.equal(req.headers.apikey,key);assert.equal(req.headers.authorization,'Bearer '+t);assert.equal(req.redirect,'error');assert.equal(req.cache,'no-store');assert.equal(req.credentials,'omit');assert.deepEqual(JSON.parse(req.body),{p_order:orderId});return response(JSON.stringify(value,null,2));});
 assert.deepEqual(await c.read({sessionToken:t,orderId}),{ok:true,value});assert.equal(calls,1);
});
test('hosted client rejects wrong environment, project, secret key and cross-project credentials before network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return response('null');};
 const config={environment:'sandbox',sandboxOrigin:origin,transport:'hosted-rpc',publishableKey:key,fetchImpl};
 for(const change of [{environment:'production'},{sandboxOrigin:'https://example.org'},{publishableKey:'sb_secret_not_allowed'},{transport:'isolated-http'},{publishableKey:undefined}])assert.throws(()=>createOrderStatusClient({...config,...change}));
 const c=client(fetchImpl);
 for(const sessionToken of [token('https://demo.example/auth/v1'),token(undefined,'service_role'),token(undefined,'authenticated',true),'invalid'])assert.deepEqual(await c.read({sessionToken,orderId}),{ok:false,code:'AUTH_REQUIRED'});
 assert.equal(calls,0);
});
test('hosted null is unavailable order, ambiguous or wrong order JSON fails closed',async()=>{
 for(const [raw,code] of [['null','NOT_FOUND'],[JSON.stringify({...value,orderId:'00000000-0000-4000-8000-000000000082'}),'UNAVAILABLE'],['{"mode":"sandbox",'+JSON.stringify(value).slice(1),'UNAVAILABLE'],[JSON.stringify({...value,source:{...value.source,totalMinor:'999'}}),'UNAVAILABLE']]){
  assert.deepEqual(await client(async()=>response(raw)).read({sessionToken:token(),orderId}),{ok:false,code});
 }
});
test('hosted mobile host is opt-in and clears old selection on session changes',async()=>{
 let latest,calls=0;
 const host=createRemittanceStatusHost({environment:'sandbox',enabled:true,sandboxOrigin:origin,transport:'hosted-rpc',publishableKey:key,expoFetch:async()=>{calls++;return response(JSON.stringify(value));},onChange:v=>latest=v});
 host.setSession(token());host.selectOrder(orderId);const rev=latest.selectionRevision;
 await host.refresh(orderId,rev);assert.equal(latest.view.state,'ready');assert.equal(calls,1);
 host.setSession(null);await host.refresh(orderId,rev);assert.equal(latest.view.state,'signed_out');assert.equal(calls,1);host.dispose();
});

test('hosted explicit authorization denial differs from missing order and transport failure',async()=>{
 for(const [status,code] of [[401,'AUTH_REQUIRED'],[403,'AUTH_REQUIRED'],[404,'NOT_FOUND'],[503,'UNAVAILABLE']]){
  const c=client(async()=>new Response('private response',{status}));
  assert.deepEqual(await c.read({sessionToken:token(),orderId}),{ok:false,code});
 }
 const isolated=createOrderStatusClient({environment:'sandbox',sandboxOrigin:'https://sandbox.invalid',fetchImpl:async()=>new Response('',{status:403})});
 assert.deepEqual(await isolated.read({sessionToken:'fixture',orderId}),{ok:false,code:'UNAVAILABLE'});
});
