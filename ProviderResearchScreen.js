import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {RESEARCH_DESTINATIONS} from './src/digital-money/project-launch-status.mjs';
import {getProviderResearchOverview,RESEARCH_PAYOUTS} from './src/digital-money/provider-research-overview.mjs';
const style={panel:{backgroundColor:'#142e45',borderRadius:12,padding:14,marginVertical:8},
 text:{color:'#dfedf6',marginVertical:5},alert:{color:'#ffdc97',marginVertical:8},
 btn:{backgroundColor:'#284c6a',padding:10,borderRadius:7,marginVertical:3}};
export default function ProviderResearchScreen(){
 const [destination,setDestination]=useState('HN');
 const [method,setMethod]=useState('bank_account');
 const result=getProviderResearchOverview({destination,method});
 return <View style={style.panel}>
  <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>Proveedores para evaluar</Text>
  <Text style={style.alert}>SOLO INVESTIGACIÓN. Ningún candidato ha firmado contrato ni confirmado que pueda mover fondos para Moneda Mundial.</Text>
  <Text style={style.text}>Destino de estudio (no país activo)</Text>
  {Object.entries(RESEARCH_DESTINATIONS).map(([code,c])=><TouchableOpacity accessibilityRole="button" key={code} style={style.btn} onPress={()=>setDestination(code)}>
   <Text style={style.text}>{destination===code?'✓ ':''}{c.country} ({code})</Text>
  </TouchableOpacity>)}
  <Text style={style.text}>Modalidad a consultar</Text>
  {Object.entries(RESEARCH_PAYOUTS).map(([id,label])=><TouchableOpacity accessibilityRole="button" key={id} style={style.btn} onPress={()=>setMethod(id)}>
   <Text style={style.text}>{method===id?'✓ ':''}{label}</Text>
  </TouchableOpacity>)}
  {result&&<View>
   <Text style={style.text}>Ruta en investigación: Estados Unidos → {result.country}</Text>
   <Text style={style.alert}>Proveedores confirmados: {result.confirmedProviders} · Transferencias reales: NO.</Text>
   {result.candidates.map(p=><View key={p.providerId} style={style.btn}>
    <Text style={{color:'#fff',fontWeight:'700'}}>{p.name}</Text>
    <Text style={style.text}>{p.study}</Text>
    <Text style={style.text}>Modalidad para investigar: {p.candidateMethodInResearch?'Sí':'No priorizada'}</Text>
    <Text style={style.text}>Requisitos documentales aún pendientes: {p.documentationMissing} / {p.documentationRequired}</Text>
    <Text style={style.alert}>Cobertura sin confirmar · Sin convenio ni sandbox otorgado.</Text>
   </View>)}
   <Text style={style.alert}>{result.nextAction}</Text>
  </View>}
  <Text style={style.alert}>Coin y Digital no están emitidas. No solicitar ni introducir documentos personales o credenciales de bancos en esta pantalla.</Text>
 </View>;
}
