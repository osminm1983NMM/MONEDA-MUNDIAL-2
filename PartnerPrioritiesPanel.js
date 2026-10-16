// Panel administrativo: lectura de prioridades, no altera datos ni envía alertas.
import React,{useEffect,useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {buildPartnerPriorityQueue} from './src/partner-priorities.mjs';
const colors={critical:'#ff9e9e',high:'#ffd592',medium:'#b3d8e4',low:'#d5e3ec'};
export default function PartnerPrioritiesPanel({supabase}){
 const [partners,setPartners]=useState([]),[expiryRows,setExpiry]=useState([]);
 const [activities,setActivities]=useState([]),[activitiesAvailable,setAvailable]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const [p,e,a]=await Promise.all([
    supabase.rpc('mwd_owner_partners_demo'),
    supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:90}),
    supabase.rpc('mwd_owner_partner_activities_demo',{p_partner_id:null})
   ]);
   if(p.error||e.error)throw(p.error||e.error);
   setPartners(Array.isArray(p.data)?p.data:[]);
   setExpiry(Array.isArray(e.data)?e.data:[]);
   setActivities(a.error?[]:(Array.isArray(a.data)?a.data:[]));
   setAvailable(!a.error);
  }catch{setError('No se pudieron consultar las prioridades del propietario.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  let live=true;
  Promise.all([
   supabase.rpc('mwd_owner_partners_demo'),
   supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:90}),
   supabase.rpc('mwd_owner_partner_activities_demo',{p_partner_id:null})
  ]).then(([p,e,a])=>{
   if(!live)return;
   if(p.error||e.error){setError('Las prioridades no están disponibles.');return;}
   setPartners(p.data||[]);setExpiry(e.data||[]);
   setActivities(a.error?[]:(a.data||[]));setAvailable(!a.error);
  }).catch(()=>{if(live)setError('No se pudieron cargar las prioridades.');});
  return()=>{live=false;};
 },[supabase]);
 const data=buildPartnerPriorityQueue({partners,expiryRows,activities,activitiesAvailable});
 return <View style={{backgroundColor:'#132d42',borderRadius:14,padding:15,marginBottom:15}}>
  <Text style={{color:'white',fontWeight:'800',fontSize:19}}>Prioridades de Moneda Mundial</Text>
  <Text style={{color:'#ffdc9e',marginVertical:8}}>Preparación administrativa; no existe autorización bancaria ni servicio con dinero real.</Text>
  <Text style={{color:'white'}}>Candidatos: {data.candidateCount} · Vencimientos críticos: {data.urgentCount} · Alertas próximas: {data.highCount}</Text>
  <TouchableOpacity accessibilityRole="button" onPress={load} disabled={busy}
   style={{backgroundColor:'#187c79',borderRadius:9,padding:13,marginVertical:12}}>
   <Text style={{color:'white',textAlign:'center'}}>{busy?'Consultando...':'Actualizar prioridades'}</Text>
  </TouchableOpacity>
  {!!error&&<Text style={{color:'#ffa1a1'}}>{error}</Text>}
  {!activitiesAvailable&&<Text style={{color:'#ffdca3'}}>Agenda todavía no disponible en Supabase: no se incluyen compromisos.</Text>}
  <Text style={{color:'white',fontWeight:'700',marginVertical:8}}>Requisitos generales pendientes de verificación</Text>
  {data.productionGates.map(x=><Text key={x.id} style={{color:'#c7dbe7',paddingVertical:4}}>
   • {x.category}: {x.name} (no verificado)</Text>)}
  <Text style={{color:'white',fontWeight:'700',marginVertical:8}}>Atención por candidato</Text>
  {!data.priorities.length&&<Text style={{color:'#bdcfdc'}}>Sin candidatos o tareas documentales registradas.</Text>}
  {data.priorities.map(x=><View key={x.key} style={{borderTopWidth:1,borderColor:'#38566e',paddingVertical:11}}>
   <Text style={{color:colors[x.priority],fontWeight:'700'}}>{x.countryCode||'GLOBAL'} · {x.title}</Text>
   <Text style={{color:'#ccdce7',marginTop:4}}>{x.nextAction}</Text>
  </View>)}
  {data.omitted>0&&<Text style={{color:'#ffdca3'}}>Hay {data.omitted} prioridades adicionales por revisar.</Text>}
  <Text style={{color:'#ffdc9e',marginTop:9}}>Bancos y agentes habilitados para pagar: 0.</Text>
 </View>;
}
