// Solo alertas documentales para candidatos a socios. No habilita bancos ni pagos.
import React,{useEffect,useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
const names={regulatory_license:'Licencia regulatoria',signed_agreement:'Contrato',jurisdiction_permissions:'Permisos por país'};
const levels={expired:'VENCIDO',due_soon:'Vence en los próximos 30 días',due_within_window:'Próximo a vencer',missing_date:'Sin fecha registrada',later:'Vigente según fecha declarada'};
export default function PartnerExpiryDashboard({supabase}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [windowDays,setWindowDays]=useState(60);
 async function load(days=windowDays){
  if(busy)return;
  setBusy(true);setError('');
  try{
   const {data,error:dbError}=await supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:days});
   if(dbError)throw dbError;
   setRows(Array.isArray(data)?data:[]);
   setWindowDays(days);
  }catch{setError('No se pudo consultar los vencimientos.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  let active=true;
  supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:60})
   .then(({data,error:e})=>{if(!active)return;if(e)setError('No se pudieron cargar los vencimientos.');else setRows(Array.isArray(data)?data:[]);})
   .catch(()=>{if(active)setError('No se pudieron cargar los vencimientos.');});
  return()=>{active=false;};
 },[supabase]);
 const expired=rows.filter(r=>r.alert_level==='expired').length;
 const soon=rows.filter(r=>r.alert_level==='due_soon'||r.alert_level==='due_within_window').length;
 const unknown=rows.filter(r=>r.alert_level==='missing_date').length;
 const btn=(label,days)=><TouchableOpacity disabled={busy} accessibilityRole="button" key={days}
  onPress={()=>load(days)} style={{backgroundColor:days===windowDays?'#187c79':'#385269',padding:11,borderRadius:9,marginVertical:5}}>
  <Text style={{color:'white',textAlign:'center'}}>{label}</Text></TouchableOpacity>;
 return <View style={{backgroundColor:'#142c42',borderRadius:12,padding:13,marginVertical:12}}>
  <Text style={{color:'white',fontSize:18,fontWeight:'700'}}>Seguimiento de licencias y contratos</Text>
  <Text style={{color:'#ffdb94',lineHeight:20,marginVertical:8}}>Fechas declaradas para planificación. No verifican una licencia ni significan autorización para operar.</Text>
  <Text style={{color:'white'}}>Vencidos: {expired} · Próximos: {soon} · Sin fecha: {unknown}</Text>
  {btn('Consultar 30 días',30)}{btn('Consultar 60 días',60)}{btn('Consultar 90 días',90)}
  {!!error&&<Text style={{color:'#ff9d9d'}}>{error}</Text>}
  {!rows.length&&<Text style={{color:'#acc8d5',marginVertical:8}}>No hay candidatos o fechas que mostrar.</Text>}
  {rows.map((r,i)=><View key={r.partner_id+':'+r.requirement_type+':'+i}
   style={{borderTopWidth:1,borderTopColor:'#34546d',paddingVertical:10}}>
   <Text style={{color:'white',fontWeight:'700'}}>{r.partner_name} · {r.country_code}</Text>
   <Text style={{color:'#c6d9e4'}}>{names[r.requirement_type]||r.requirement_type}</Text>
   <Text style={{color:'#ffdba0'}}>{levels[r.alert_level]||'Pendiente'}</Text>
   <Text style={{color:'#c6d9e4'}}>Fecha registrada: {r.valid_until||'No especificada'}</Text>
  </View>)}
  <Text style={{color:'#ffdb94',marginTop:12}}>Socios y pagos reales habilitados: 0. Solo seguimiento administrativo.</Text>
 </View>;
}
