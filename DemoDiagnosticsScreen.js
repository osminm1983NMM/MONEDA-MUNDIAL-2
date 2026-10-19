import React from 'react';
import {View,Text,StyleSheet,Linking,TouchableOpacity} from 'react-native';
import metadata from './src/digital-money/demo-build-info.json';
import {safeDemoBuildInfo,demoGithubRunUrl} from './src/digital-money/demo-build-info.mjs';
export default function DemoDiagnosticsScreen({language='es'}){
 const d=safeDemoBuildInfo(metadata);
 const en=language==='en';
 const actionsUrl=demoGithubRunUrl(d);
 return <View style={s.card}>
  <Text style={s.title}>{en?'App diagnostics (DEMO)':'Diagnóstico de aplicación (DEMO)'}</Text>
  <Text style={s.text}>{en?'Version':'Versión'}: {d?.version||'N/D'}</Text>
  <Text style={s.text}>Git commit: {d?.commit|| (en?'Not embedded':'No incorporado')}</Text>
  <Text style={s.text}>GitHub Actions: {d?.runId|| (en?'Not embedded':'No incorporado')}</Text>
  {!!actionsUrl&&<TouchableOpacity accessibilityRole="link" onPress={()=>Linking.openURL(actionsUrl).catch(()=>{})}><Text style={s.link}>{en?'Open this build on GitHub':'Abrir esta compilación en GitHub'}</Text></TouchableOpacity>}
  <Text style={s.text}>{en?'Run attempt':'Intento de ejecución'}: {d?.runAttempt||'N/D'}</Text>
  <Text style={s.notice}>{en?'DEMO ONLY — NO REAL MONEY':'SOLO DEMOSTRACIÓN — SIN DINERO REAL'}</Text>
  <Text style={s.notice}>{en?'A build identifier does not prove testing on a physical Samsung or financial compliance.':'El identificador de compilación no certifica pruebas en Samsung físico ni cumplimiento financiero.'}</Text>
 </View>;
}
const s=StyleSheet.create({card:{padding:18,borderRadius:12,backgroundColor:'#13253e'},title:{fontSize:20,color:'#fff',fontWeight:'700',marginBottom:10},text:{fontSize:14,color:'#d4e0f1',marginBottom:8},link:{color:'#8fc1ff',marginBottom:11,textDecorationLine:'underline'},notice:{fontSize:13,color:'#ffda88',marginVertical:7}});
