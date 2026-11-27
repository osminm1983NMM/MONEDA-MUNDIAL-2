'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createPortfolioClient:create}=require('../../financial-sandbox/digital-coin-portfolio-client.cjs');
const {createExpoPortfolio}=require('../../financial-sandbox/mobile/digital-coin-portfolio-expo.js');
const origin='https://tfamyuqqpenilnovqjpp.supabase.co',key='sb_publishable_synthetic_test_only';
const token='e30.'+Buffer.from(JSON.stringify({iss:origin+'/auth/v1',role:'authenticated',is_anonymous:false})).toString('base64url')+'.test';
const portfolio={mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:'123456',reservedMinor:'0',totalMinor:'123456'},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]};
const snap={kind:'immutable_wallet_snapshot',exportedAt:'2026-11-27T12:00:00.000Z',portfolio};
const opts={environment:'sandbox',sandboxOrigin:origin,transport:'hosted-snapshot',publishableKey:key};
const reply=v=>new Response(JSON.stringify(v,null,2),{headers:{'content-type':'application/json'}});
test('hosted snapshot accepts dated exact response, fixed endpoint and no actor parameter',async()=>{
 const c=create({...opts,fetchImpl:async(url,init)=>{a.equal(url,origin+'/rest/v1/rpc/mwd_lab_read_wallet_snapshot');a.equal(init.method,'POST');a.equal(init.body,'{}');a.equal(init.headers.apikey,key);a.equal(init.headers.authorization,'Bearer '+token);return reply(snap);}});
 a.deepEqual(await c.read(token),{ok:true,value:portfolio,snapshot:{kind:snap.kind,exportedAt:snap.exportedAt}});
});
test('rejects foreign tokens before transport, undated or invalid snapshots and absent authorization',async()=>{
 let calls=0;const c=create({...opts,fetchImpl:async()=>{calls++;return reply(snap);}});
 a.deepEqual(await c.read('demo-token'),{ok:false,code:'AUTH_REQUIRED'});a.equal(calls,0);
 for(const v of [portfolio,{...snap,exportedAt:'2026-02-30T12:00:00.000Z'},{...snap,extra:true}])a.deepEqual(await create({...opts,fetchImpl:async()=>reply(v)}).read(token),{ok:false,code:'UNAVAILABLE'});
 a.deepEqual(await create({...opts,fetchImpl:async()=>reply(null)}).read(token),{ok:false,code:'AUTH_REQUIRED'});
 a.throws(()=>create({...opts,sandboxOrigin:'https://elsewhere.invalid'}),/INVALID_HOSTED_CONFIG/);
});
test('mobile snapshot always labels captured balances and clears date and balances on logout',async()=>{
 const views=[];const React={createElement:(type,props,...children)=>({type,props,children})},Native={View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'};
 const expo=createExpoPortfolio({...opts,enabled:true,React,Native,expoFetch:async()=>reply(snap),onChange:v=>views.push(v)});
 const flatten=n=>typeof n==='string'?n:n?.children?.map(flatten).join(' ')||'';
 const render=locale=>{const t=expo.render(locale);return flatten(t.type(t.props));};
 expo.setSession(token);await expo.refresh(views.at(-1).revision);
 a.match(render('es'),/NO es saldo en tiempo real/);a.match(render('en'),/NOT live balances/);a.match(render('es'),/2026-11-27T12:00:00.000Z/);a.match(render('es'),/123456/);
 expo.setSession(null);a.doesNotMatch(render('es'),/123456|2026-11-27T12:00:00.000Z/);expo.dispose();
});
