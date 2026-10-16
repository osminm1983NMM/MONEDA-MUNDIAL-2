// Lista informativa de requisitos: no es certificación ni autorización.
import React from 'react';
import {View,Text} from 'react-native';
import {buildLaunchReadinessReport,LAUNCH_STAGE_LABELS} from './src/launch-readiness.mjs';
export default function LaunchReadinessPanel(){
 const report=buildLaunchReadinessReport();
 return <View style={{backgroundColor:'#142e40',borderRadius:13,padding:14,marginBottom:17}}>
  <Text style={{color:'#fff',fontSize:19,fontWeight:'800'}}>Requisitos para el lanzamiento</Text>
  <Text style={{color:'#ffdb98',marginVertical:8,lineHeight:20}}>El prototipo aún NO está listo para dinero real. La preparación tecnológica no reemplaza acuerdos ni autorizaciones.</Text>
  <Text style={{color:'#d7e8ef'}}>Funciones diseñadas en modo demo: {report.demoComponents}</Text>
  <Text style={{color:'#d7e8ef'}}>Verificaciones pendientes: {report.pendingVerification}</Text>
  <Text style={{color:'#d7e8ef'}}>Requisitos externos pendientes: {report.externalRequirements}</Text>
  {report.checks.map(item=><View key={item.id} style={{borderTopWidth:1,borderColor:'#39566b',paddingVertical:10}}>
   <Text style={{color:'#fff',fontWeight:'700'}}>{item.category} · {item.title}</Text>
   <Text style={{color:'#ffdb98',marginTop:3}}>{LAUNCH_STAGE_LABELS[item.stage]}</Text>
   <Text style={{color:'#bcd4df',marginTop:3}}>Siguiente acción: {item.next}</Text>
  </View>)}
  <Text style={{color:'#ffdb98'}}>Corredores con dinero real habilitados: {report.activeRealMoneyCountries}. Agentes pagadores autorizados confirmados: {report.confirmedAuthorizedPayoutAgents}.</Text>
 </View>;
}
