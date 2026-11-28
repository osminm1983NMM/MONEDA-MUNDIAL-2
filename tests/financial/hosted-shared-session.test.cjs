'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createHostedSessionFence:createFence}=require('../../financial-sandbox/mobile/hosted-session-fence.js');
const {createRemittanceStatusHost}=require('../../financial-sandbox/mobile/remittance-status-host.js');
const {createExpoPortfolio}=require('../../financial-sandbox/mobile/digital-coin-portfolio-expo.js');
const origin='https://tfamyuqqpenilnovqjpp.supabase.co',key='sb_publishable_synthetic_test_only';
const token='e30.'+Buffer.from(JSON.stringify({iss:origin+'/auth/v1',role:'authenticated',is_anonymous:false})).toString('base64url')+'.test';
const id='00000000-0000-4000-8000-000000000001';
const status={mode:'sandbox',orderId:id,status:'paid',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
const snapshot={kind:'immutable_wallet_snapshot',exportedAt:'2026-11-27T12:00:00.000Z',portfolio:{mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:'123456',reservedMinor:'0',totalMinor:'123456'},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]}};
const json=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
const opts={environment:'sandbox',enabled:true,sandboxOrigin:origin,publishableKey:key};
const React={createElement:(type,props,...children)=>({type,props,children})},Native={View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'};
function fixture(){
 let lost=0,r,w,rReply=()=>json(status),wReply=()=>json(snapshot);
 const fence=createFence(()=>{lost++;remittance.setSession(null);wallet.setSession(null);});
 const remittance=createRemittanceStatusHost({...opts,transport:'hosted-rpc',expoFetch:async()=>rReply(),onChange:v=>{r=v;fence.observe('remittance',v.view);}});
 const wallet=createExpoPortfolio({...opts,transport:'hosted-snapshot',React,Native,expoFetch:async()=>wReply(),onChange:v=>{w=v;fence.observe('wallet',v);}});
 const signIn=()=>{fence.arm();remittance.setSession(token);wallet.setSession(token);remittance.selectOrder(id);};
 const refreshR=()=>remittance.refresh(id,r.selectionRevision),refreshW=()=>wallet.refresh(w.revision);
 return {signIn,refreshR,refreshW,remittance,wallet,fence,lost:()=>lost,r:()=>r,w:()=>w,replyR:x=>{rReply=x;},replyW:x=>{wReply=x;}};
}
for(const [source,httpStatus] of [['remittance',401],['remittance',403],['wallet',401],['wallet',403]])test(source+' HTTP '+httpStatus+' authorization failure clears both ready views once',async()=>{
 const f=fixture();f.signIn();await f.refreshR();await f.refreshW();a.equal(f.r().view.state,'ready');a.equal(f.w().state,'ready');
 if(source==='remittance'){f.replyR(()=>new Response('',{status:httpStatus}));await f.refreshR();}
 else{f.replyW(()=>new Response('',{status:httpStatus}));await f.refreshW();}
 a.equal(f.lost(),1);a.equal(f.r().view.state,'signed_out');a.equal(f.r().orderId,null);a.equal(f.w().state,'signed_out');a.equal(f.w().value,undefined);
 f.replyR(()=>json(status));f.replyW(()=>json(snapshot));f.signIn();await f.refreshR();await f.refreshW();a.equal(f.r().view.state,'ready');a.equal(f.w().state,'ready');
 f.fence.disarm();f.remittance.dispose();f.wallet.dispose();a.equal(f.lost(),1);
});
test('network failure and missing remittance do not force shared logout',async()=>{
 const f=fixture();f.signIn();await f.refreshR();await f.refreshW();
 f.replyR(()=>json(null));await f.refreshR();a.equal(f.r().view.code,'NOT_FOUND');a.equal(f.w().state,'ready');
 f.replyW(()=>{throw Error('offline');});await f.refreshW();a.equal(f.w().state,'error');a.equal(f.lost(),0);
});
test('absent hosted snapshot is fail-closed, not a claim that remote revocation occurred',async()=>{
 const f=fixture();f.signIn();await f.refreshR();f.replyW(()=>json(null));await f.refreshW();
 a.equal(f.lost(),1);a.equal(f.r().view.state,'signed_out');a.equal(f.w().state,'signed_out');
});

for(const slowSource of ['remittance','wallet'])for(const delayedStatus of [200,403])test(slowSource+' delayed HTTP '+delayedStatus+' cannot affect replacement shared session',{timeout:5000},async()=>{
 const f=fixture();f.signIn();await f.refreshR();await f.refreshW();
 let release,started;
 const gate=new Promise(resolve=>{release=resolve;});
 const entered=new Promise(resolve=>{started=resolve;});
 // Deliberately ignore transport cancellation: the hosts must also fence stale results.
 const delayed=()=>{started();return gate;};
 const slowIsR=slowSource==='remittance';
 if(slowIsR)f.replyR(delayed);else f.replyW(delayed);
 const pending=slowIsR?f.refreshR():f.refreshW();
 try{
  await entered;
  if(slowIsR){f.replyW(()=>new Response('',{status:401}));await f.refreshW();}
  else{f.replyR(()=>new Response('',{status:401}));await f.refreshR();}
  a.equal(f.lost(),1);a.equal(f.r().view.state,'signed_out');a.equal(f.w().state,'signed_out');
  f.replyR(()=>json(status));f.replyW(()=>json(snapshot));f.signIn();await f.refreshR();await f.refreshW();
  const currentR=f.r(),currentW=f.w();
  a.equal(currentR.view.state,'ready');a.equal(currentW.state,'ready');
  release(delayedStatus===403?new Response('',{status:403}):json(slowIsR?{...status,status:'refunded'}:{...snapshot,exportedAt:'2026-11-26T12:00:00.000Z'}));
  await pending;
  // Permit late transport continuations to finish even if abort settled the host early.
  await new Promise(resolve=>setImmediate(resolve));
  a.equal(f.lost(),1);a.strictEqual(f.r(),currentR);a.strictEqual(f.w(),currentW);
 }finally{
  release(json(slowIsR?status:snapshot));f.fence.disarm();f.remittance.dispose();f.wallet.dispose();
 }
});
