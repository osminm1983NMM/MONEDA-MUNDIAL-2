import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {listMockAuditPreview} from './src/admin/mock-audit-preview.mjs';
const base={backgroundColor:'#142d47',padding:12,borderRadius:10,marginTop:10};
const white={color:'#edf5ff',marginBottom:5};
export default function MockAuditPreviewScreen(){
 const [country,setCountry]=useState('ALL');
 const data=listMockAuditPreview({country});
 return <View style={base}>
 <Text style={{...white,fontSize:18,fontWeight:'bold'}}>Historial de auditoría · Ejemplo</Text>
 <Text style={{color:'#fbd68b',marginBottom:8}}>SOLO DATOS INVENTADOS. Sin conexión con auditorías de PostgreSQL, bancos o clientes. No confirma fondos ni pagos.</Text>
 <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
 {['ALL','HN','NI'].map(c=><TouchableOpacity key={c} accessibilityRole="button"
 onPress={()=>setCountry(c)} style={{padding:9,backgroundColor:country===c?'#527fb1':'#294764',borderRadius:7}}>
 <Text style={white}>{c==='ALL'?'Todos':c}</Text></TouchableOpacity>)}
 </View>
 <Text style={white}>Eventos de demostración: {data.total} · Sólo lectura</Text>
 {data.events.map(row=><View key={row.id} style={{...base,backgroundColor:'#244561'}}>
 <Text style={{...white,fontWeight:'bold'}}>{row.id} · {row.caseId}</Text>
 <Text style={white}>{row.event}</Text><Text style={white}>{row.reviewer} · {row.stage}</Text>
 </View>)}
 <Text style={{color:'#fbd68b',marginTop:10}}>Integridad en la aplicación: NO VERIFICADA. Sin aprobación, desembolso ni reembolso.</Text>
 </View>;
}
