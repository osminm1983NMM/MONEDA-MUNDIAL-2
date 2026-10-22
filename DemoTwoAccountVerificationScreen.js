// Prueba guiada A/B para Samsung: solo sesiones y monedas ficticias.
// Pasos permanecen en RAM entre salir y volver a entrar a la cuenta.
// Ninguna llamada confirma transacciones: usuario convierte manualmente.
import React,{useState,useEffect,useRef} from 'react';
import {View,Text,TouchableOpacity,Alert} from 'react-native';
import {twoAccountDemoVerification} from './src/digital-money/demo-two-account-verification.mjs';
const names={start:'prepareA',a_before:'finishA',a_after:'prepareB',b_before:'finishB',b_after:'verifyA'};
const style={
 card:{backgroundColor:'#13253e',padding:18,borderRadius:12,marginBottom:15},
 title:{color:'#fff',fontSize:19,fontWeight:'700',marginBottom:10},
 muted:{color:'#d4e0f1',lineHeight:21,marginBottom:10},
 warning:{color:'#ffdb91',marginBottom:11,lineHeight:19},
 success:{color:'#96ebaf',marginBottom:12,lineHeight:20},
 button:{backgroundColor:'#276af1',padding:13,borderRadius:9,marginBottom:10},
 txt:{color:'#fff',textAlign:'center',fontWeight:'700'},
};
const messages={
 es:{
 title:'Prueba A / B — COIN ↔ Digital',
 start:'1. Entra a la cuenta A y toma una lectura inicial.',
 a_before:'2. En Conversión confirma UNA conversión COIN → Digital de A, vuelve y verifica.',
 a_after:'3. Cierra sesión de A, entra a cuenta B DIFERENTE y verifica el aislamiento.',
 b_before:'4. En Conversión confirma UNA conversión Digital → COIN de B, vuelve y verifica.',
 b_after:'5. Cierra B, vuelve a A y confirma que su saldo no cambió por B.',
 pass:'PASS — Historiales y saldos A/B coinciden con las dos conversiones de DEMO.',
 action:'Registrar y comprobar este paso',
 reset:'Reiniciar guía (no borra ninguna operación)',
 failed:'FALLÓ / NO VERIFICADO: revisa que el paso corresponda a la cuenta y dirección correctas. No realices nuevas conversiones si hay una pendiente.',
 warning:'SOLO DEMO. No compartas tus contraseñas ni códigos. Esta guía no mueve fondos, ni valida dinero real. Cerrar la aplicación reinicia la guía.',
 },
 en:{
 title:'A / B check — COIN ↔ Digital',
 start:'1. Sign in as account A and capture initial state.',
 a_before:'2. In Conversion manually confirm ONE COIN → Digital conversion for A, then return and verify.',
 a_after:'3. Sign out A, sign in as DIFFERENT account B, and verify isolation.',
 b_before:'4. In Conversion manually confirm ONE Digital → COIN conversion for B, then return and verify.',
 b_after:'5. Sign out B, sign in A again and confirm B did not change A.',
 pass:'PASS — A/B histories and balances agree with two new DEMO conversions.',
 action:'Record and check this step',
 reset:'Restart guide (does not erase transactions)',
 failed:'FAILED / NOT VERIFIED: check session and conversion direction. Do not retry if a conversion is pending.',
 warning:'DEMO ONLY. Never share passwords or codes. No funds move in this guide. Restarting the app clears the guide.',
 }
};
export default function DemoTwoAccountVerificationScreen({supabase,userId,sessionGuard,language='es'}){
 const t=messages[language]||messages.es;
 const [stage,setStage]=useState(twoAccountDemoVerification.getStage());
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 const mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 async function onCheck(){
  const action=names[stage];if(!action||busy)return;
  const ticket=sessionGuard.capture(userId);
  if(!ticket)return;
  setBusy(true);setFailed(false);
  const isCurrent=()=>mounted.current&&sessionGuard.sameSession(ticket);
  try{
   const result=await twoAccountDemoVerification[action]({supabase,userId,isCurrent});
   if(isCurrent()){setStage(result.stage);setFailed(false);}
  }catch(e){if(isCurrent())setFailed(true);}
  finally{if(isCurrent())setBusy(false);}
 }
 function onReset(){
  if(busy)return;
  const proceed=()=>{
   try{twoAccountDemoVerification.reset();setStage('start');setFailed(false);}catch(e){setFailed(true);}
  };
  Alert.alert(t.reset,t.warning,[{text:language==='en'?'Cancel':'Cancelar',style:'cancel'},{text:language==='en'?'Restart':'Reiniciar',onPress:proceed}]);
 }
 return <View style={style.card}>
  <Text style={style.title}>{t.title}</Text>
  <Text style={style.warning}>{t.warning}</Text>
  <Text style={style.muted}>{t[stage]||t.pass}</Text>
  {failed&&<Text style={style.warning}>{t.failed}</Text>}
  {stage==='pass'&&<Text style={style.success}>{t.pass}</Text>}
  {stage!=='pass'&&<TouchableOpacity accessibilityRole="button" disabled={busy}
    style={[style.button,busy&&{opacity:.5}]} onPress={onCheck}>
    <Text style={style.txt}>{t.action}</Text>
  </TouchableOpacity>}
  <TouchableOpacity accessibilityRole="button" disabled={busy}
    style={[style.button,{backgroundColor:'#334b68'},busy&&{opacity:.5}]} onPress={onReset}>
    <Text style={style.txt}>{t.reset}</Text>
  </TouchableOpacity>
 </View>;
}
