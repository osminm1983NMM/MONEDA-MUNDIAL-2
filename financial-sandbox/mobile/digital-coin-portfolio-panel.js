'use strict';
// Isolated React Native view for synthetic wallet, no writes, pricing or storage.
// Display exact minor units; Coin decimal precision is deliberately not assumed.
const {validPortfolio}=require('../digital-coin-portfolio-contract.cjs');
const messages={
 es:{title:'Billetera Digital y Coin',warning:'PRUEBA — SIN DINERO REAL',refresh:'Actualizar billetera',loading:'Consultando…',idle:'Consulta tus saldos de prueba.',auth:'Inicia sesión para consultar.',error:'No se pudo consultar. Inténtalo nuevamente.',disabled:'Billetera de pruebas no conectada.',digital:'Moneda Mundial Digital',coin:'Moneda Mundial Coin',available:'Disponible',reserved:'Reservado',total:'Total',pending:'Redención pendiente (USD de prueba)',minor:'unidades mínimas de prueba',history:'Conversiones de prueba',empty:'Sin conversiones.',more:'Se muestran hasta 20 conversiones.',digital_to_coin:'Digital a Coin',coin_to_digital:'Coin a Digital',quoted:'Cotizada',reservedState:'Reservada',confirmed:'Confirmada',cancelled:'Cancelada'},
 en:{title:'Digital and Coin wallet',warning:'TEST ONLY — NO REAL MONEY',refresh:'Refresh wallet',loading:'Checking…',idle:'Check your test balances.',auth:'Sign in to check balances.',error:'Unable to check. Try again.',disabled:'Test wallet not connected.',digital:'Moneda Mundial Digital',coin:'Moneda Mundial Coin',available:'Available',reserved:'Reserved',total:'Total',pending:'Pending redemption (test USD)',minor:'test minor units',history:'Test conversions',empty:'No conversions.',more:'Showing up to 20 conversions.',digital_to_coin:'Digital to Coin',coin_to_digital:'Coin to Digital',quoted:'Quoted',reservedState:'Reserved',confirmed:'Confirmed',cancelled:'Cancelled'}
};
function createPortfolioPanel(React,Native){
 if(typeof React?.createElement!=='function'||!Native?.View||!Native?.Text||!Native?.TouchableOpacity)throw Error('INVALID_NATIVE_HOST');
 const h=React.createElement,{View,Text,TouchableOpacity}=Native;
 const styles={card:{padding:16,borderRadius:12,backgroundColor:'#13253e',marginBottom:16},title:{fontSize:20,fontWeight:'700',color:'#fff',marginBottom:8},warning:{fontSize:13,color:'#f4cc81',marginBottom:10},text:{fontSize:15,color:'#d4e0f1',marginBottom:6},section:{paddingVertical:8},button:{padding:12,marginTop:8,backgroundColor:'#276af1',borderRadius:8},buttonText:{fontWeight:'700',color:'#fff',textAlign:'center'},disabled:{opacity:0.5}};
 return function PortfolioPanel({enabled=false,revision,view,locale='es',onRefresh,requireSnapshot=false}={}){
  const t=locale==='en'?messages.en:messages.es;
  const active=enabled===true&&view?.enabled===true&&Number.isSafeInteger(revision)&&revision>=0&&view.revision===revision&&typeof onRefresh==='function';
  const state=active?view.state:'disabled';
  const snap=view?.snapshot;
  const dated=snap&&Object.keys(snap).length===2&&snap.kind==='immutable_wallet_snapshot'&&typeof snap.exportedAt==='string'&&Number.isFinite(Date.parse(snap.exportedAt))&&new Date(snap.exportedAt).toISOString()===snap.exportedAt;
  const ready=state==='ready'&&validPortfolio(view.value)&&(requireSnapshot?dated:snap===undefined)?view.value:null;
  const blocked=!active||!['idle','ready','error'].includes(state);
  const line=(label,value)=>h(Text,{key:label,style:styles.text},label+': '+value);
  const amount=n=>n+' '+t.minor;
  const usd=n=>{const p=n.padStart(3,'0');return p.slice(0,-2)+(locale==='en'?'.':',')+p.slice(-2)+' USD';};
  const message=state==='disabled'?t.disabled:state==='signed_out'?t.auth:state==='loading'?t.loading:state==='error'||state==='ready'?t.error:t.idle;
  const cards=ready?ready.assets.map((b,i)=>h(View,{key:b.asset,style:styles.section},
   h(Text,{style:styles.title},i===0?t.digital:t.coin),line(t.available,amount(b.availableMinor)),line(t.reserved,amount(b.reservedMinor)),line(t.total,amount(b.totalMinor)))):[];
  const history=ready?ready.conversions.slice(-20).reverse().map(q=>h(View,{key:q.quoteId,style:styles.section},
   h(Text,{style:styles.text},t[q.direction]+' — '+t[q.state==='reserved'?'reservedState':q.state]),
   line(t.digital,amount(q.digitalMinor)),line(t.coin,amount(q.coinMinor)))):[];
  return h(View,{style:styles.card},
   h(Text,{style:styles.title,accessibilityRole:'header'},t.title),
   h(Text,{style:styles.warning},t.warning),
   ready?h(View,{accessibilityLiveRegion:'polite'},...(dated?[h(Text,{key:'snapshot',style:styles.warning},(locale==='en'?'Archived test snapshot — NOT live balances · UTC: ':'Captura contable de prueba — NO es saldo en tiempo real · UTC: ')+snap.exportedAt)]:[]),...cards,line(t.pending,usd(ready.pendingRedemptionUsdMinor)),
    h(Text,{style:styles.title},t.history),...(history.length?history:[h(Text,{key:'empty',style:styles.text},t.empty)]),
    ...(ready.conversions.length>20?[h(Text,{key:'more',style:styles.text},t.more)]:[])):
    h(Text,{style:styles.text,accessibilityLiveRegion:'polite'},message),
   h(TouchableOpacity,{style:[styles.button,blocked&&styles.disabled],disabled:blocked,accessibilityRole:'button',
    accessibilityState:{disabled:blocked,busy:state==='loading'},onPress:()=>{if(!blocked)onRefresh(revision);}},
    h(Text,{style:styles.buttonText},state==='loading'?t.loading:t.refresh)));
 };
}
module.exports={createPortfolioPanel};
