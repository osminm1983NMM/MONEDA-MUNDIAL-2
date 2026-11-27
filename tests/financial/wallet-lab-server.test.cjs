'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const http=require('node:http');
const {createWalletLabServer:create}=require('../../financial-sandbox/wallet-lab-server.cjs');
const actor='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const project='https://tfamyuqqpenilnovqjpp.supabase.co';
const token='e30.'+Buffer.from(JSON.stringify({iss:project+'/auth/v1',role:'authenticated',is_anonymous:false,sub:actor})).toString('base64url')+'.test';
const route='/v1/sandbox/wallet/portfolio';
function fixture(extra={}){
 let calls=0,reads=0,active=true;
 const ledger={reconciliationRequired:()=>true,verifiedPricingRequired:()=>true,reconciliationSnapshot:()=>{reads++;return {manifest:{format:'synthetic-digital-coin-manifest-v1'},projection:{mode:'sandbox',digital:{mode:'sandbox',accounts:[{owner:actor,available:'120',reserved:'20'},{owner:other,available:'999',reserved:'0'}],redemptions:[]},coin:{mode:'sandbox',asset:'COIN_TEST',accounts:[]},quotes:[]}};}};
 const server=create({environment:'sandbox',enabled:true,publishableKey:'sb_publishable_synthetic_test_only',enrolledActors:[actor],ledger,fetchImpl:async()=>{calls++;return new Response(JSON.stringify(active?{environment:'sandbox',actor}:null),{headers:{'content-type':'application/json'}});},...extra});
 return {server,counts:()=>[calls,reads],revoke(){active=false;}};
}
test('actual loopback TCP serves own wallet only, then denies revoked token',async()=>{
 const f=fixture();try{
  const origin=await f.server.start();a.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  const get=()=>fetch(origin+route,{headers:{authorization:'Bearer '+token}});
  let res=await get();a.equal(res.status,200);a.equal(res.headers.get('cache-control'),'no-store');a.equal((await res.json()).assets[0].totalMinor,'140');
  f.revoke();res=await get();a.equal(res.status,401);a.deepEqual(f.counts(),[2,1]);await a.rejects(f.server.start(),/INVALID_LISTENER_STATE/);
 }finally{await f.server.close();}
});
test('rejects writes, owner selection, forged authority, foreign origin and absent bearer before querying',async()=>{
 const f=fixture();try{
  const origin=await f.server.start(),url=origin+route,headers={authorization:'Bearer '+token};
  for(const [u,opts,status] of [[url,{method:'POST',headers},405],[url+'?owner='+other,{headers},400],[url,{headers:{...headers,origin:'https://elsewhere.invalid'}},403],[url,{headers:{}},401]]){
   const res=await fetch(u,opts);a.equal(res.status,status);await res.body.cancel();
  }
  const status=await new Promise((resolve,reject)=>{const req=http.get(url,{headers:{...headers,host:'elsewhere.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});a.equal(status,400);a.deepEqual(f.counts(),[0,0]);
 }finally{await f.server.close();}
});
test('close before start is terminal; concurrent close is idempotent',async()=>{
 const f=fixture();const p=f.server.close();a.equal(f.server.close(),p);await p;await a.rejects(f.server.start(),/INVALID_LISTENER_STATE/);
});
test('wallet listener cannot enable production or ungated ledger',()=>{
 a.throws(()=>fixture({enabled:false}),/WALLET_LAB_DISABLED/);
 a.throws(()=>fixture({environment:'production'}),/WALLET_LAB_DISABLED/);
 a.throws(()=>fixture({ledger:{reconciliationRequired:()=>false}}),/HOSTED_WALLET_DISABLED/);
});
