'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const {createPortfolioPanel}=require('../../financial-sandbox/mobile/digital-coin-portfolio-panel.js');
const React={createElement:(type,props,...children)=>({type,props,children})};
const Panel=createPortfolioPanel(React,{View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'});
const flatten=node=>typeof node==='string'?node:node?.children?.map(flatten).join(' ')||'';
const button=node=>node.children.find(n=>n?.type==='TouchableOpacity');
const quote={quoteId:'q',direction:'digital_to_coin',digitalMinor:'50',coinMinor:'75',state:'confirmed',expiresAt:100};
const value={mode:'sandbox',assets:[{asset:'DIGITAL_TEST',availableMinor:'9007199254740993',reservedMinor:'20',totalMinor:'9007199254741013'},{asset:'COIN_TEST',availableMinor:'75',reservedMinor:'0',totalMinor:'75'}],pendingRedemptionUsdMinor:'12345',conversions:[quote]};
const props={enabled:true,revision:7,view:{enabled:true,revision:7,state:'ready',value},onRefresh:()=>{}};
test('Spanish wallet renders exact test units, separate redemption and conversion state',()=>{
 const s=flatten(Panel(props));for(const expected of ['SIN DINERO REAL','Moneda Mundial Digital','Moneda Mundial Coin','9007199254740993','9007199254741013','123,45 USD','Confirmada','unidades mínimas de prueba'])a.ok(s.includes(expected),expected);
});
test('English labels and revision-scoped refresh callback',()=>{
 const calls=[];const tree=Panel({...props,locale:'en',onRefresh:r=>calls.push(r)});
 a.match(flatten(tree),/TEST ONLY/);a.match(flatten(tree),/123\.45 USD/);a.match(flatten(tree),/Confirmed/);
 button(tree).props.onPress();a.deepEqual(calls,[7]);
});
test('disabled, stale, signed out and loading never show old values or permit refresh',()=>{
 let calls=0;
 for(const patch of [{enabled:false},{revision:8},{revision:undefined},{view:{...props.view,enabled:false}},{view:{...props.view,state:'signed_out'}},{view:{...props.view,state:'loading'}}]){
  const tree=Panel({...props,...patch,onRefresh:()=>calls++});a.doesNotMatch(flatten(tree),/9007199254740993/);a.equal(button(tree).props.disabled,true);button(tree).props.onPress();
 }
 a.equal(calls,0);
});
test('invalid wallet values fail closed; empty history is explicit',()=>{
 const bad=Panel({...props,view:{...props.view,value:{...value,private:'hidden'}}});
 a.doesNotMatch(flatten(bad),/9007199254740993|hidden/);a.match(flatten(bad),/No se pudo consultar/);
 const empty=Panel({...props,view:{...props.view,value:{...value,conversions:[]}}});a.match(flatten(empty),/Sin conversiones/);
});
test('long conversion history bounds rendered records and indicates truncation',()=>{
 const conversions=Array.from({length:25},(_,i)=>({...quote,quoteId:'q'+i}));
 const tree=Panel({...props,view:{...props.view,value:{...value,conversions}}});
 const s=flatten(tree);a.equal((s.match(/Digital a Coin/g)||[]).length,20);a.match(s,/hasta 20 conversiones/);
});
