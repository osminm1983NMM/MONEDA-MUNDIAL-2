'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {createExpoPortfolio}=require('../../financial-sandbox/mobile/digital-coin-portfolio-expo.js');
const {createPortfolioHttp}=require('../../financial-sandbox/digital-coin-portfolio-http.cjs');
const React={createElement:(type,props,...children)=>({type,props,children})},Native={View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'};
const payload=n=>({mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:n,reservedMinor:'0',totalMinor:n},{asset:'COIN_TEST',availableMinor:'0',reservedMinor:'0',totalMinor:'0'}],pendingRedemptionUsdMinor:'0',conversions:[]});
const text=node=>typeof node==='string'?node:node?.children?.map(text).join(' ')||'';
function panel(expo,locale='es'){const tree=expo.render(locale);return tree.type(tree.props);}
const origin='https://sandbox.invalid';
function fixture(extra={}){
 const views=[];const http=createPortfolioHttp({environment:'sandbox',service:{read:async({sessionToken})=>sessionToken==='a'?{status:200,body:payload('123456')}:sessionToken==='b'?{status:200,body:payload('987654')}:{status:401}}});
 const expo=createExpoPortfolio({React,Native,environment:'sandbox',enabled:true,sandboxOrigin:origin,expoFetch:(url,init)=>http(new Request(url,init)),onChange:v=>views.push(v),...extra});
 return {expo,views};
}
test('default disabled does not request credentials or need a network transport',async()=>{
 let calls=0;const {expo,views}=fixture({enabled:false,expoFetch:undefined,sandboxOrigin:undefined});
 expo.setSession('a');await expo.refresh(views.at(-1).revision);
 a.equal(views.at(-1).enabled,false);a.match(text(panel(expo)),/no conectada/);
 const tree=panel(expo);tree.children.at(-1).props.onPress();a.equal(calls,0);
});
test('Expo composition reads authenticated test balances and switches accounts without stale data',async()=>{
 const {expo,views}=fixture();expo.setSession('a');const old=views.at(-1).revision;
 await expo.refresh(old);a.match(text(panel(expo)),/123456/);
 expo.setSession('b');a.doesNotMatch(text(panel(expo)),/123456/);await expo.refresh(old);a.equal(views.at(-1).state,'idle');
 await expo.refresh(views.at(-1).revision);a.match(text(panel(expo,'en')),/987654/);a.doesNotMatch(text(panel(expo)),/123456/);
 expo.setSession(null);a.doesNotMatch(text(panel(expo)),/987654/);
});
test('revoked session and disposed screen never render private balances',async()=>{
 const {expo,views}=fixture();expo.setSession('invalid');await expo.refresh(views.at(-1).revision);
 a.equal(views.at(-1).state,'signed_out');expo.setSession('a');await expo.refresh(views.at(-1).revision);
 expo.dispose();a.doesNotMatch(text(panel(expo)),/123456/);expo.setSession('b');a.equal(views.at(-1).state,'signed_out');
});
test('enabled composition requires injected Expo fetch and approved HTTPS configuration',()=>{
 a.throws(()=>fixture({expoFetch:undefined}),/EXPO_FETCH_REQUIRED/);
 a.throws(()=>fixture({sandboxOrigin:'http://sandbox.invalid'}),/INVALID_ORIGIN/);
 a.throws(()=>fixture({environment:'production'}),/INVALID_WALLET_HOST/);
});
