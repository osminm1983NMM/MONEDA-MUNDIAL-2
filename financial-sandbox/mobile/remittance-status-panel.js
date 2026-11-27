'use strict';
// React Native component factory; isolated from App.js and all network access.
// Host passes the current session's presentation state and read-only refresh.
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const strings={
 es:{title:'Seguimiento de remesa',warning:'PRUEBA — SIN DINERO REAL',disabled:'Servicio de pruebas no conectado.',idle:'Consulta una remesa de prueba.',loading:'Consultando…',refresh:'Consultar estado',principal:'Monto enviado',fee:'Comisión',total:'Total',destination:'Monto de destino',date:'Aceptada (UTC)',auth:'Inicia sesión nuevamente.',missing:'Remesa no disponible.',invalid:'Selecciona una remesa válida.',unavailable:'No se pudo consultar. Inténtalo de nuevo.'},
 en:{title:'Remittance tracking',warning:'TEST ONLY — NO REAL MONEY',disabled:'Test service not connected.',idle:'Check a test remittance.',loading:'Checking…',refresh:'Check status',principal:'Sent amount',fee:'Fee',total:'Total',destination:'Destination amount',date:'Accepted (UTC)',auth:'Sign in again.',missing:'Remittance unavailable.',invalid:'Select a valid remittance.',unavailable:'Unable to check. Try again.'}
};
function createRemittanceStatusPanel(React,Native){
 if(typeof React?.createElement!=='function'||!Native?.View||!Native?.Text||!Native?.TouchableOpacity)throw Error('INVALID_NATIVE_HOST');
 const h=React.createElement,{View,Text,TouchableOpacity}=Native;
 const styles={card:{backgroundColor:'#13253e',padding:20,borderRadius:17,marginBottom:17},title:{color:'#fff',fontWeight:'700',fontSize:21,marginBottom:12},warning:{color:'#f4cc81',fontSize:13,marginBottom:12},text:{color:'#d4e0f1',fontSize:15,marginBottom:8},button:{padding:14,borderRadius:10,backgroundColor:'#276af1',marginTop:10},buttonText:{color:'#fff',fontWeight:'700',textAlign:'center'},disabled:{opacity:0.5}};
 return function RemittanceStatusPanel({enabled=false,orderId,view,locale='es',onRefresh}={}){
  const t=locale==='en'?strings.en:strings.es;
  const active=enabled===true&&typeof orderId==='string'&&uuid.test(orderId)&&typeof onRefresh==='function';
  const state=active?view?.state:'disabled';
  const data=state==='ready'&&view?.value?.mode==='sandbox'&&view.value.orderId===orderId&&
   ['statusLabel','principal','fee','total','destination','acceptedAt'].every(k=>typeof view.value[k]==='string')?view.value:null;
  const message=state==='disabled'?t.disabled:state==='loading'?t.loading:state==='signed_out'?t.auth:state==='error'?
   ({AUTH_REQUIRED:t.auth,NOT_FOUND:t.missing,INVALID_REQUEST:t.invalid,UNAVAILABLE:t.unavailable})[view.code]||t.unavailable:
   state==='ready'&&!data?t.unavailable:t.idle;
  const blocked=!active||state==='loading'||state==='signed_out';
  const line=(label,value)=>h(Text,{key:label,style:styles.text},label+': '+value);
  return h(View,{style:styles.card},
   h(Text,{style:styles.title,accessibilityRole:'header'},t.title),
   h(Text,{style:styles.warning},t.warning),
   data?h(View,{accessibilityLiveRegion:'polite'},
    h(Text,{style:styles.title},data.statusLabel),
    line(t.principal,data.principal),line(t.fee,data.fee),line(t.total,data.total),
    line(t.destination,data.destination),line(t.date,data.acceptedAt)
   ):h(Text,{style:styles.text,accessibilityLiveRegion:'polite'},message),
   h(TouchableOpacity,{style:[styles.button,blocked&&styles.disabled],accessibilityRole:'button',
    accessibilityState:{disabled:blocked,busy:state==='loading'},disabled:blocked,
    onPress:()=>{if(!blocked)onRefresh(orderId);}},
    h(Text,{style:styles.buttonText},state==='loading'?t.loading:t.refresh)));
 };
}
module.exports={createRemittanceStatusPanel};
