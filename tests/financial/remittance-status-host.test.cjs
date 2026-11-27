'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createRemittanceStatusHost:create}=require('../../financial-sandbox/mobile/remittance-status-host.js');
const {createRemittanceStatusPanel}=require('../../financial-sandbox/mobile/remittance-status-panel.js');
const {createOrderStatusHttp}=require('../../financial-sandbox/order-status-http.cjs');
const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
const value=orderId=>({mode:'sandbox',orderId,status:'paid',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'});
const React={createElement:(type,props,...children)=>({type,props,children})};
const Panel=createRemittanceStatusPanel(React,{View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'});
const treeText=n=>typeof n==='string'?n:n?.children?.map(treeText).join(' ')||'';
const fixture=(fetchImpl,enabled=true)=>{
 const states=[];const host=create({environment:'sandbox',enabled,sandboxOrigin:'https://sandbox.invalid',expoFetch:fetchImpl,onChange:s=>states.push(s)});
 return {host,states,last:()=>states.at(-1)};
};
test('disabled host cannot send even with a supplied session or order',async()=>{
 let calls=0;const f=fixture(()=>{calls++;},false);
 f.host.setSession('token');f.host.selectOrder(first);await f.host.refresh(first);
 a.equal(f.last().enabled,false);a.equal(calls,0);
});
test('mobile composition calls actual HTTP handler and renders only selected status',async()=>{
 const requests=[];
 const handle=createOrderStatusHttp({environment:'sandbox',service:{async read(x){requests.push(x);return {status:200,body:value(x.orderId)};}}});
 const f=fixture((url,init)=>handle(new Request(url,init)));
 f.host.setSession('token');f.host.selectOrder(first);await f.host.refresh(first);
 a.equal(f.last().view.state,'ready');
 const tree=Panel({...f.last(),onRefresh:f.host.refresh});a.match(treeText(tree),/2\.500,00 HNL/);
 f.host.selectOrder(second);a.equal(f.last().view.state,'idle');a.doesNotMatch(treeText(Panel({...f.last(),onRefresh:f.host.refresh})),/2\.500,00 HNL/);
 await f.host.refresh(first);a.equal(requests.length,1);
 await f.host.refresh(second);a.equal(requests.length,2);
 a.deepEqual(requests[1],{sessionToken:'token',orderId:second});
 a.ok(!JSON.stringify(f.states).includes('token'));
});
test('session change, invalid token and disposal erase state and ignore late response',async()=>{
 const pending=[];
 const f=fixture((url,init)=>new Promise(resolve=>pending.push({resolve,init})));
 const complete=(i,id)=>pending[i].resolve(new Response(JSON.stringify(value(id)),{headers:{'content-type':'application/json','cache-control':'no-store'}}));
 f.host.setSession('old-token');f.host.selectOrder(first);const p=f.host.refresh(first);
 await f.host.refresh(first);a.equal(pending.length,1);
 f.host.setSession('new-token');a.equal(f.last().orderId,null);complete(0,first);await p;
 a.equal(f.last().view.state,'idle');a.equal(f.last().enabled,false);
 f.host.selectOrder(first);const q=f.host.refresh(first);f.host.setSession('bad token');complete(1,first);await q;
 a.equal(f.last().view.state,'signed_out');a.equal(f.last().orderId,null);
 f.host.setSession('valid');f.host.selectOrder(second);const r=f.host.refresh(second);f.host.dispose();complete(2,second);await r;
 a.equal(f.last().enabled,false);a.equal(f.last().view.state,'signed_out');
});
