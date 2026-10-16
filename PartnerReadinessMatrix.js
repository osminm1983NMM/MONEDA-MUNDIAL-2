// Panel de revisión documental; requiere mwd_owner_partner_readiness_overview_demo.
// La RPC valida el rol propietario en servidor y solo devuelve metadatos.
import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {buildPartnerReadinessMatrix} from './src/partner-readiness-matrix.mjs';
import {canApplySessionResponse} from './src/session-guards.mjs';

const COLOR={background:'#132d42',text:'#d1e2ec',warn:'#ffe0ad',btn:'#187c79'};
const STATE={draft:'Borrador',under_review:'En revisión',needs_changes:'Solicita ajustes',
 documented:'Documentación revisada internamente'};
const PRIORITY={critical:'Vencimientos registrados',high:'Faltan fechas críticas',
 medium:'Revisión interna pendiente',external:'Pendiente de validación externa'};
export default function PartnerReadinessMatrix({supabase}){
 const [report,setReport]=useState(null);
 const [countryFilter,setCountryFilter]=useState('');
 const [visible,setVisible]=useState(12);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const mounted=useRef(false),requestId=useRef(0);
 async function load(){
  const id=++requestId.current;
  setBusy(true);setReport(null);setError('');
  const current=()=>mounted.current&&id===requestId.current;
  try{
   const before=await supabase.auth.getSession();
   const userId=before.data?.session?.user?.id;
   if(!userId)throw Error('not_authenticated');
   const response=await supabase.rpc('mwd_owner_partner_readiness_overview_demo',
      {p_country_code:null});
   if(response.error)throw response.error;
   if(!Array.isArray(response.data))throw Error('invalid_response');
   const after=await supabase.auth.getSession();
   if(!canApplySessionResponse(userId,after.data?.session))throw Error('session_changed');
   if(current()){
     setReport(buildPartnerReadinessMatrix(response.data));
     setVisible(12);
   }
  }catch(e){
   if(current()){
     const code=e?.code;
     setError(code==='PGRST202'||code==='42883'
       ?'La matriz documental está preparada, pero su consulta aún no está instalada.'
       :code==='42501'||code==='PGRST301'
        ?'Acceso denegado. La matriz es exclusiva del propietario.'
        :'No se pudo consultar la matriz de revisión. Comprueba la conexión y sesión.');
   }
  }finally{if(current())setBusy(false);}
 }
 useEffect(()=>{
  mounted.current=true;load();
  return()=>{mounted.current=false;requestId.current+=1;};
 },[supabase]);
 const normalized=countryFilter.trim().toUpperCase();
 const rows=report?.records.filter(r=>!normalized||r.countryCode.startsWith(normalized))||[];
 const listing=rows.slice(0,visible);
 return <View style={{backgroundColor:COLOR.background,borderRadius:13,padding:14,marginVertical:12}}>
  <Text style={{color:'white',fontWeight:'800',fontSize:19}}>Matriz de futuros bancos y agentes</Text>
  <Text style={{color:COLOR.warn,marginVertical:8,lineHeight:20}}>
   Solo planificación documental. Revisar diez requisitos internos NO comprueba licencias ni autoriza retirar dinero.
  </Text>
  <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={load}
   style={{backgroundColor:COLOR.btn,borderRadius:8,padding:12}}>
   <Text style={{color:'white',textAlign:'center'}}>{busy?'Consultando...':'Actualizar matriz documental'}</Text>
  </TouchableOpacity>
  {!!error&&<Text style={{color:'#ffaaaa',marginTop:8}}>{error}</Text>}
  {report&&<View>
    <Text style={{color:COLOR.text,marginTop:10}}>
     Candidatos: {report.candidates} · Países: {report.countries} · Con vencimientos: {report.expiredCandidates}
    </Text>
    <Text style={{color:COLOR.text,marginTop:5}}>
     Con fechas críticas faltantes: {report.missingDateCandidates} · Con requisitos revisados internamente: {report.internallyReviewedCandidates}
    </Text>
    <TextInput accessibilityLabel="Filtrar país" value={countryFilter}
      onChangeText={x=>{setCountryFilter(x.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2));setVisible(12);}}
      maxLength={2} autoCapitalize="characters" autoCorrect={false}
      placeholder="Filtrar país: NI, HN, CR..." placeholderTextColor="#9ebacc"
      style={{color:'white',backgroundColor:'#2b4559',padding:12,borderRadius:8,marginVertical:10}} />
    {!rows.length&&<Text style={{color:COLOR.text}}>Sin candidatos para el filtro seleccionado.</Text>}
    {listing.map(r=><View key={r.id} style={{borderTopColor:'#466276',borderTopWidth:1,paddingVertical:11}}>
      <Text style={{color:'white',fontWeight:'700'}}>{r.countryCode} · {r.name}</Text>
      <Text style={{color:COLOR.text}}>Estado: {STATE[r.internalStatus]||'Pendiente'} · Sucursales propuestas: {r.proposedBranches}</Text>
      <Text style={{color:COLOR.text}}>Requisitos internos: {r.internallyReviewed}/{r.requirements} · Pendientes: {r.pendingRequirements}</Text>
      <Text style={{color:COLOR.warn}}>Vencidos: {r.expiredRequirements} · Próximos (30 días): {r.due30Requirements} · Sin fecha crítica: {r.missingCriticalDates}</Text>
      <Text style={{color:COLOR.warn}}>{PRIORITY[r.attention]} · NO habilitado para pagar</Text>
    </View>)}
    {rows.length>visible&&<TouchableOpacity accessibilityRole="button"
      onPress={()=>setVisible(n=>n+12)} style={{backgroundColor:'#36536d',borderRadius:8,padding:12}}>
      <Text style={{color:'white',textAlign:'center'}}>Mostrar más candidatos ({rows.length-visible} restantes)</Text>
    </TouchableOpacity>}
    <Text style={{color:COLOR.warn,marginTop:10}}>Bancos y agentes operativos confirmados: 0. Pagos reales habilitados: NO.</Text>
  </View>}
 </View>;
}
