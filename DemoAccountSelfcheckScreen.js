// Pantalla de diagnóstico personal SOLO DEMOSTRACIÓN.
// Usa la sesión autenticada de Supabase, sin tokens, contraseñas, ni escrituras.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { runDemoAccountSelfcheck } from './src/digital-money/demo-account-selfcheck.mjs';

const styles={
  card:{backgroundColor:'#13253e',borderRadius:17,padding:20,marginBottom:17},
  heading:{color:'#fff',fontSize:21,fontWeight:'700',marginBottom:12},
  info:{color:'#d4e0f1',lineHeight:21,marginBottom:12},
  warning:{color:'#f4cc81',lineHeight:20,marginBottom:12},
  success:{color:'#9de1b0',lineHeight:21,marginBottom:12},
  button:{backgroundColor:'#276af1',padding:15,borderRadius:11,alignItems:'center'},
  buttonText:{color:'#fff',fontSize:15,fontWeight:'700'},
};

export default function DemoAccountSelfcheckScreen({supabase,userId,sessionGuard,labels}){
  const [busy,setBusy]=useState(false);
  const [state,setState]=useState('idle');
  const mounted=useRef(false);
  const lock=useRef(false);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{mounted.current=false;};
  },[]);
  async function check(){
    if(lock.current||!mounted.current||!userId||!sessionGuard)return;
    const ticket=sessionGuard.capture(userId);
    if(!ticket)return;
    lock.current=true;
    setBusy(true);
    setState('running');
    const isCurrent=()=>mounted.current&&sessionGuard.sameSession(ticket);
    try {
      const result=await runDemoAccountSelfcheck({supabase,userId,isCurrent});
      if(isCurrent())setState(result.status==='pass'?'pass':'failed');
    }catch {
      // Sin mostrar detalles de errores del servidor ni identificadores del usuario.
      if(isCurrent())setState('failed');
    }finally{
      lock.current=false;
      if(isCurrent())setBusy(false);
    }
  }
  return <View style={styles.card}>
    <Text style={styles.heading}>{labels.selfcheckTitle}</Text>
    <Text style={styles.info}>{labels.selfcheckHelp}</Text>
    {state==='pass' && <Text accessibilityRole="text" style={styles.success}>{labels.selfcheckPass}</Text>}
    {state==='failed' && <Text accessibilityRole="text" style={styles.warning}>{labels.selfcheckFail}</Text>}
    {state==='running' && <Text style={styles.info}>{labels.selfcheckBusy}</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={busy}
      onPress={check} style={[styles.button,busy&&{opacity:0.5}]}>
      <Text style={styles.buttonText}>{busy?labels.selfcheckBusy:labels.selfcheckRun}</Text>
    </TouchableOpacity>
    <Text style={[styles.warning,{marginTop:14}]}>{labels.selfcheckLimit}</Text>
  </View>;
}
