import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {projectMockAlerts} from './src/admin/mock-financial-alert-dashboard.mjs';
import {assessMockTransferVelocity} from './src/server/mock-transfer-velocity.mjs';
const FIXTURE_NOW=1800000000000;
const SAMPLE_EVENTS=Object.freeze([
 ['mock-demo-evt-00001','SIM-HN-A001','HN',10000,'attempted_mock'],
 ['mock-demo-evt-00002','SIM-HN-A001','HN',10000,'rejected_mock'],
 ['mock-demo-evt-00003','SIM-HN-A001','NI',12000,'rejected_mock'],
 ['mock-demo-evt-00004','SIM-HN-A001','CR',10000,'rejected_mock'],
 ['mock-demo-evt-00005','SIM-NI-B001','NI',10000,'attempted_mock'],
].map(([eventId,actorAlias,destination,amountCents,outcome])=>
 Object.freeze({eventId,actorAlias,destination,amountCents,outcome,
 atMs:FIXTURE_NOW-1000})));
const SAMPLE_VELOCITY=assessMockTransferVelocity({events:SAMPLE_EVENTS,nowMs:FIXTURE_NOW});
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
  {mode==='owner'&&<View style={style.box}>
   <Text style={style.heading}>Frecuencia de operaciones · Ejemplo inventado</Text>
   <Text style={style.warn}>Sin usuarios reales, ni movimientos bancarios. Umbrales ilustrativos, no regulatorios.</Text>
   <Text style={style.text}>Perfiles de muestra: {SAMPLE_VELOCITY.cases} · Con señales ficticias: {SAMPLE_VELOCITY.requiresReview}</Text>
   {SAMPLE_VELOCITY.results.map(row=><View key={row.alias} style={style.box}>
     <Text style={style.text}>{row.alias} · Intentos en 1 h: {row.attemptsHour} · Rechazos: {row.rejectedHour}</Text>
     <Text style={style.text}>Destinos 24 h: {row.destinationCountDay} · Importe ficticio: USD {(row.amountCentsDay/100).toFixed(2)}</Text>
     <Text style={style.warn}>{row.requiresManualReview?'Revisar supuesto manualmente':'Sin señales en el ejemplo (no es aprobación)'}</Text>
   </View>)}
 </View>}
 <Text style={style.warn}>Permisos reales de bancos y agentes: NO implementados. No se puede confirmar, desbloquear o devolver dinero aquí.</Text>
 </View>;
}
