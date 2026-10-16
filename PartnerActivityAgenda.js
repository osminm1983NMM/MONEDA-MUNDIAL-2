// Solo preparación visual de citas y tareas administrativas.
// No envía invitaciones ni recordatorios; la persistencia depende de RPCs privadas.
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';
import {parsePartnerExpiryDate} from './src/partner-expiry-dates.mjs';

const KINDS=[['meeting_plan','Reunión propuesta'],['followup','Próximo contacto'],['document_review','Revisión de documentos'],['internal_task','Tarea interna']];
const COLORS={panel:'#142c42',input:'#2b4d63',button:'#187a76',text:'#fff',note:'#ffdba2'};
export default function PartnerActivityAgenda({supabase,partnerId}){
 const [activities,setActivities]=useState([]);
 const [kind,setKind]=useState('meeting_plan');
 const [title,setTitle]=useState('');
 const [date,setDate]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 const [backendAvailable,setBackendAvailable]=useState(false);

 async function refresh(id){
  const {data,error:e}=await supabase.rpc('mwd_owner_partner_activities_demo',{p_partner_id:id});
  if(e)throw e;
  setActivities(Array.isArray(data)?data:[]);
  setBackendAvailable(true);
 }
 useEffect(()=>{
  let active=true;
  setActivities([]);setError('');setSaved(false);setBackendAvailable(false);
  if(!partnerId)return()=>{active=false;};
  supabase.rpc('mwd_owner_partner_activities_demo',{p_partner_id:partnerId})
   .then(({data,error:e})=>{
    if(!active)return;
    if(e){setError('Agenda todavía pendiente de activación en Supabase.');return;}
    setActivities(Array.isArray(data)?data:[]);setBackendAvailable(true);
   }).catch(()=>{if(active)setError('Agenda todavía no disponible.');});
  return()=>{active=false;};
 },[partnerId,supabase]);
 async function save(existing=null){
  if(busy||!partnerId||!backendAvailable)return;
  const due=existing?.due_on||date.trim();
  const candidateTitle=existing?.title||title.trim();
  const parsed=parsePartnerExpiryDate(due);
  if(!parsed.valid||!parsed.date){setError('Fecha inválida: utiliza AAAA-MM-DD.');return;}
  if(candidateTitle.length<3||candidateTitle.length>120||/@|https?:\/\/|www\.|\d{8,}/i.test(candidateTitle)){
   setError('Título inválido: no incluyas correos, teléfonos ni enlaces.');return;
  }
  setBusy(true);setError('');setSaved(false);
  try{
   const {data,error:e}=await supabase.rpc('mwd_owner_partner_activity_save_demo',{
    p_partner_id:partnerId,p_activity_kind:existing?.activity_kind||kind,
    p_title:candidateTitle,p_due_on:parsed.date,p_activity_id:existing?.id||null,
    p_activity_status:existing?'completed':'planned'
   });
   if(e)throw e;
   if(data?.real_payments_enabled!==false)throw Error('Respuesta no válida');
   await refresh(partnerId);
   if(!existing){setTitle('');setDate('');}
   setSaved(true);
  }catch{setError('No fue posible guardar la actividad de prueba.');}
  finally{setBusy(false);}
 }
 function action(label,fn,chosen=false){
  return <TouchableOpacity accessibilityRole="button" key={label} onPress={fn}
    disabled={busy||!backendAvailable}
    style={{backgroundColor:chosen?'#165d57':COLORS.button,padding:11,borderRadius:8,marginVertical:4,opacity:backendAvailable?1:0.5}}>
   <Text style={{color:COLORS.text,textAlign:'center'}}>{label}</Text>
  </TouchableOpacity>;
 }
 return <View style={{backgroundColor:COLORS.panel,padding:13,borderRadius:12,marginVertical:12}}>
  <Text style={{color:COLORS.text,fontWeight:'700',fontSize:18}}>Agenda de futuros socios</Text>
  <Text style={{color:COLORS.note,marginVertical:8}}>Solo compromisos propuestos. No programa reuniones ni envía mensajes a nadie. No certifica bancos ni habilita pagos.</Text>
  {KINDS.map(([id,label])=>action((kind===id?'✓ ':'')+label,()=>setKind(id),kind===id))}
  <TextInput style={{backgroundColor:COLORS.input,color:COLORS.text,padding:12,borderRadius:8,marginVertical:5}}
   placeholder="Ejemplo: revisar documentos" placeholderTextColor="#b9c9d7" value={title} onChangeText={setTitle}/>
  <TextInput style={{backgroundColor:COLORS.input,color:COLORS.text,padding:12,borderRadius:8,marginVertical:5}}
   placeholder="Fecha AAAA-MM-DD" placeholderTextColor="#b9c9d7" value={date} onChangeText={setDate}/>
  {action('Guardar compromiso de prueba',()=>save())}
  {!!error&&<Text style={{color:'#ffb4af'}}>{error}</Text>}
  {saved&&<Text style={{color:'#b5efcd'}}>Actividad guardada como planificación interna.</Text>}
  {activities.map(a=><View key={a.id} style={{borderTopWidth:1,borderColor:'#39546b',paddingVertical:9}}>
   <Text style={{color:COLORS.text}}>{a.title} · {a.due_on}</Text>
   <Text style={{color:'#a9c3d3'}}>Estado: {a.activity_status}</Text>
   {a.activity_status==='planned'&&action('Marcar completada',()=>save(a))}
  </View>)}
 </View>;
}
