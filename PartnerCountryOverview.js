import React,{useEffect,useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {buildCountryReadinessOverview} from './src/partner-country-overview.mjs';
// Resumen de preparación DOCUMENTAL. CERO bancos operativos.
export default function PartnerCountryOverview({supabase}){
 const [partners,setPartners]=useState([]),[expiry,setExpiry]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  if(busy)return;setBusy(true);setError('');
  try{
   const [p,e]=await Promise.all([
    supabase.rpc('mwd_owner_partners_demo'),
    supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:60})
   ]);
   if(p.error||e.error)throw(p.error||e.error);
   setPartners(p.data||[]);setExpiry(e.data||[]);
  }catch{setError('No se pudo consultar el resumen administrativo.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  let active=true;
  Promise.all([supabase.rpc('mwd_owner_partners_demo'),
   supabase.rpc('mwd_owner_partner_expiry_dashboard_demo',{p_days:60})])
   .then(([p,e])=>{
    if(!active)return;
    if(p.error||e.error)setError('No se pudo cargar el resumen.');
    else{setPartners(p.data||[]);setExpiry(e.data||[]);}
   }).catch(()=>{if(active)setError('No se pudo cargar el resumen.');});
  return()=>{active=false;};
 },[supabase]);
 const rows=buildCountryReadinessOverview(partners,expiry);
 return <View style={{backgroundColor:'#10293A',borderRadius:12,padding:14,marginVertical:12}}>
  <Text style={{color:'#fff',fontSize:18,fontWeight:'700'}}>Preparación mundial por país</Text>
  <Text style={{color:'#F3D49A',lineHeight:20,marginVertical:8}}>Candidatos administrativos, no bancos autorizados. Ningún país puede efectuar retiros reales.</Text>
  <Text style={{color:'#c9dfeb'}}>Países con candidatos registrados: {rows.length} · Bancos habilitados: 0</Text>
  <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={load}
   style={{backgroundColor:'#187c79',borderRadius:9,padding:12,marginVertical:8}}>
   <Text style={{color:'white',textAlign:'center'}}>{busy?'Consultando...':'Actualizar resumen de países'}</Text>
  </TouchableOpacity>
  {!!error&&<Text style={{color:'#ffa5a5'}}>{error}</Text>}
  {!rows.length&&<Text style={{color:'#b9ccd9'}}>Todavía no hay candidatos financieros registrados.</Text>}
  {rows.map(row=><View key={row.countryCode} style={{borderTopWidth:1,borderColor:'#37566c',paddingVertical:10}}>
   <Text style={{color:'white',fontWeight:'700'}}>{row.countryCode} · {row.candidates} candidatos</Text>
   <Text style={{color:'#bbd3df'}}>En revisión: {row.underReview} · Documentación revisada: {row.documentsReviewed}</Text>
   <Text style={{color:'#ffd7a1'}}>Vencidos: {row.expired} · Próximos: {row.dueSoon} · Sin fecha: {row.missingDates}</Text>
   <Text style={{color:'#ffd7a1'}}>Retiros reales: NO DISPONIBLES</Text>
  </View>)}
 </View>;
}
