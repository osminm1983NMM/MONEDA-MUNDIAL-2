'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {createPortfolioHost:create}=require('../../financial-sandbox/mobile/digital-coin-portfolio-host.js');
const value=n=>({mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:n,reservedMinor:'0',totalMinor:n},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]});
function fixture(read,enabled=true){
 const views=[];const host=create({environment:'sandbox',enabled,client:{read},onChange:v=>views.push(v)});
 return {host,views,last:()=>views.at(-1)};
}
test('refresh publishes only validated balances without exposing credentials',async()=>{
 const f=fixture(async()=>({ok:true,value:value('12')}));
 f.host.setSession('secret-token');await f.host.refresh(f.last().revision);
 a.equal(f.last().state,'ready');a.equal(f.last().value.assets[0].totalMinor,'12');a.equal(JSON.stringify(f.views).includes('secret-token'),false);
 f.host.setSession(null);a.equal(f.last().state,'signed_out');a.equal(f.last().value,undefined);
});
test('account switch aborts old read, discards late data and rejects outdated refresh presses',async()=>{
 let finish,signal,calls=0;const f=fixture(async(token,s)=>{calls++;if(token==='a'){signal=s;return new Promise(resolve=>{finish=resolve;});}return {ok:true,value:value('99')};});
 f.host.setSession('a');const old=f.last().revision;const pending=f.host.refresh(old);
 f.host.setSession('b');a.equal(signal.aborted,true);a.equal(f.last().state,'idle');
 await f.host.refresh(old);a.equal(calls,1);
 await f.host.refresh(f.last().revision);finish({ok:true,value:value('11')});await pending;
 a.equal(f.last().value.assets[0].totalMinor,'99');
});
test('revoked session clears existing data and blocks further refresh until login',async()=>{
 let calls=0;const f=fixture(async()=>++calls===1?{ok:true,value:value('12')}:{ok:false,code:'AUTH_REQUIRED'});
 f.host.setSession('a');await f.host.refresh(f.last().revision);await f.host.refresh(f.last().revision);
 a.equal(f.last().state,'signed_out');a.equal(f.last().value,undefined);await f.host.refresh(f.last().revision);a.equal(calls,2);
});
test('disabled host and malformed response fail closed',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return {ok:true,value:{...value('12'),private:'secret'}};},false);
 f.host.setSession('a');await f.host.refresh(f.last().revision);a.equal(calls,0);a.equal(f.last().enabled,false);
 const g=fixture(async()=>({ok:true,value:{...value('12'),private:'secret'}}));
 g.host.setSession('a');await g.host.refresh(g.last().revision);a.equal(g.last().state,'error');a.equal(g.last().value,undefined);
});
test('dispose aborts request and late result cannot repopulate closed view',async()=>{
 let finish,signal;const f=fixture(async(_,s)=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
 f.host.setSession('a');const p=f.host.refresh(f.last().revision);f.host.dispose();a.equal(signal.aborted,true);
 finish({ok:true,value:value('12')});await p;f.host.setSession('b');a.equal(f.last().state,'signed_out');a.equal(f.last().value,undefined);
});
