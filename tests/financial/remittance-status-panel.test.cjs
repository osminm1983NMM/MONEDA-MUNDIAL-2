'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createRemittanceStatusPanel}=require('../../financial-sandbox/mobile/remittance-status-panel.js');
const {presentStatus}=require('../../financial-sandbox/order-status-presentation.cjs');
const orderId='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const data={mode:'sandbox',orderId,status:'paid',source:{currency:'USD',principalMinor:'10000',feeMinor:'150',totalMinor:'10150'},destination:{currency:'HNL',amountMinor:'250000'},acceptedAt:'2026-11-26T15:00:00.000Z'};
// Structural component contract only; actual native rendering needs Expo/Android.
const React={createElement:(type,props,...children)=>({type,props,children})};
const Panel=createRemittanceStatusPanel(React,{View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity'});
const flatten=node=>typeof node==='string'?node:node?.children?.map(flatten).join(' ')||'';
const button=node=>node.children.find(n=>n?.type==='TouchableOpacity');
test('disconnected by default, never exposes prior order data',()=>{
 let calls=0;const onRefresh=()=>calls++;
 const view={state:'ready',value:presentStatus(data)};
 for(const props of [{orderId,view,onRefresh},{enabled:true,orderId:other,view,onRefresh},{enabled:true,orderId,view:{state:'signed_out'},onRefresh}]){
  const tree=Panel(props);a.match(flatten(tree),/SIN DINERO REAL/);a.doesNotMatch(flatten(tree),/2\.500,00 HNL/);
 }
 const tree=Panel({orderId,view,onRefresh});a.equal(button(tree).props.disabled,true);button(tree).props.onPress();a.equal(calls,0);
});
test('ready state renders only current synthetic order and refreshes read-only UUID',()=>{
 const calls=[];const view={state:'ready',value:presentStatus(data,'en')};
 const tree=Panel({enabled:true,orderId,view,locale:'en',onRefresh:id=>calls.push(id)});
 a.match(flatten(tree),/TEST ONLY/);a.match(flatten(tree),/Payout confirmed in test/);a.match(flatten(tree),/101\.50 USD/);a.match(flatten(tree),/2,500\.00 HNL/);
 button(tree).props.onPress();a.deepEqual(calls,[orderId]);
 const loading=Panel({enabled:true,orderId,view:{state:'loading'},onRefresh:id=>calls.push(id)});
 a.equal(button(loading).props.accessibilityState.busy,true);button(loading).props.onPress();a.deepEqual(calls,[orderId]);a.doesNotMatch(flatten(loading),/101\.50 USD/);
});
