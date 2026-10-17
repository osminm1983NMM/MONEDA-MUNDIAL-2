import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import LaunchReadinessPanel from './LaunchReadinessPanel';
import {buildProjectLaunchStatus,RESEARCH_DESTINATIONS} from './src/digital-money/project-launch-status.mjs';
const s={card:{backgroundColor:'#142e45',padding:14,borderRadius:12,marginVertical:8},text:{color:'#dbeaf3',marginVertical:5},alert:{color:'#ffe0a0',marginVertical:8},button:{padding:12,backgroundColor:'#294e70',borderRadius:8,marginVertical:4}};
export default function ProjectLaunchStatusScreen(){
 const [destination,setDestination]=useState('HN');
 const report=buildProjectLaunchStatus({destination});
 return <View style={s.card}>
  <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>Estado de preparación · Moneda Mundial</Text>
  <Text style={s.alert}>SOLO INVESTIGACIÓN Y DEMOSTRACIÓN. Ningún país está habilitado para transferencias reales.</Text>
  {Object.entries(RESEARCH_DESTINATIONS).map(([code,x])=><TouchableOpacity key={code} style={s.button} accessibilityRole="button" onPress={()=>setDestination(code)}>
   <Text style={s.text}>{destination===code?'✓ ':''}{x.country} · {code}</Text>
  </TouchableOpacity>)}
  {report&&<View>
   <Text style={s.text}>Corredor de estudio: Estados Unidos (USD) → {report.country} ({report.destinationCurrency})</Text>
   <Text style={s.text}>Requisitos de dinero real sin verificación documental: {report.fiatRequirementsUnverified} de {report.fiatRequirementCount}</Text>
   <Text style={s.text}>Acuerdos financieros confirmados: NO · Países activos: {report.liveCountries}</Text>
   {report.cryptoPhases.map(p=><Text key={p.id} style={s.text}>{p.label}: {p.missingEvidenceCount} de {p.requirementCount} documentos aún sin verificación externa.</Text>)}
   <Text style={s.alert}>Ni Coin ni Digital están emitidas. No hay intercambio, pagos comerciales ni retiro de efectivo reales.</Text>
  </View>}
  <LaunchReadinessPanel/>
 </View>;
}
