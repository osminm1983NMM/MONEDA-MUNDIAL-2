import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {projectMockAlerts} from './src/admin/mock-financial-alert-dashboard.mjs';
const style={box:{backgroundColor:'#1a304b',padding:14,borderRadius:12,marginVertical:8},
 text:{color:'#d8e5f5',marginVertical:5},warn:{color:'#ffda92',marginVertical:8},
 heading:{color:'#fff',fontSize:18,fontWeight:'700',marginVertical:6},
 btn:{padding:10,backgroundColor:'#305b88',borderRadius:8,marginVertical:5}};
export default function MockAlertsAdminScreen(){
 const [mode,setMode]=useState('owner');
 const [entityId,setEntityId]=useState(null);
 const view=projectMockAlerts({role:mode,entityId});
 const choose=(role,id=null)=>{setMode(role);setEntityId(id);};
 return <View style={style.box}>
  <Text style={style.heading}>Alertas financieras · Laboratorio</Text>
  <Text style={style.warn}>TODOS LOS DATOS SON INVENTADOS. Ninguna alerta proviene de bancos ni de usuarios. Las opciones de vista NO conceden permisos reales.</Text>
  {[
    ['Propietario · ejemplo','owner',null],
    ['Banco HN · ejemplo','bank','bank-hn'],
    ['Banco NI · ejemplo','bank','bank-ni'],
    ['Agente HN · ejemplo','agent','agent-hn'],
    ['Agente NI · ejemplo','agent','agent-ni'],
   ].map(([label,role,id])=><TouchableOpacity key={label} accessibilityRole="button"
   onPress={()=>choose(role,id)} style={style.btn}><Text style={style.text}>{mode===role&&entityId===id?'✓ ':''}{label}</Text></TouchableOpacity>)}
  <Text style={style.text}>Casos visibles: {view.total} · Requieren revisión: {view.flagged}</Text>
  {view.alerts.map(a=><View key={a.id} style={style.box}>
    <Text style={style.heading}>{a.id} · {a.country}</Text>
    <Text style={style.text}>{a.summary}</Text>
    {a.amountCents!==undefined&&<Text style={style.text}>Importe de muestra: USD {(a.amountCents/100).toFixed(2)}</Text>}
    {a.signals&&a.signals.length>0&&<Text style={style.text}>Señales técnicas ficticias: {a.signals.join(', ')}</Text>}
  </View>)}
  <Text style={style.warn}>Permisos reales de bancos y agentes: NO implementados. No se puede confirmar, desbloquear o devolver dinero aquí.</Text>
 </View>;
}
