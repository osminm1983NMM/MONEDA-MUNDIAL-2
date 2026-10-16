// Seguimiento interno de propuestas. Ningún estado implica convenio firmado.
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';
import {parsePartnerExpiryDate} from './src/partner-expiry-dates.mjs';
const stages=[
 ['not_contacted','Sin contactar'],['outreach_planned','Contacto planificado'],
 ['contact_recorded','Contacto registrado'],['discussion','Conversaciones'],
 ['due_diligence','Evaluación documental'],['draft_contract_review','Borrador de contrato en revisión'],
 ['paused','En pausa'],['closed','Cerrado sin activar']
];
export default function PartnerEngagementTracker({supabase,partnerId}){
 const [stage,setStage]=useState('not_contacted'),[date,setDate]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{
  let live=true;setStage('not_contacted');setDate('');setSaved(false);setError('');
  if(!partnerId)return()=>{live=false;};
  supabase.rpc('mwd_owner_partner_engagement_demo',{p_partner_id:partnerId})
   .then(({data,error:e})=>{
    if(!live)return;if(e){setError('No se pudo consultar el seguimiento.');return;}
    const item=Array.isArray(data)?data[0]:null;
    setStage(item?.stage||'not_contacted');setDate(item?.next_followup||'');
   }).catch(()=>{if(live)setError('No se pudo consultar el seguimiento.');});
  return()=>{live=false;};
 },[supabase,partnerId]);
 async function save(){
  if(busy||!partnerId)return;
  const parsed=parsePartnerExpiryDate(date);
  if(!parsed.valid){setError('Usa una fecha válida AAAA-MM-DD.');return;}
  if(stage==='closed'&&parsed.date){setError('Para cerrar, borra la fecha de seguimiento.');return;}
  setBusy(true);setError('');setSaved(false);
  try{
   const {data,error:e}=await supabase.rpc('mwd_owner_partner_engagement_save_demo',{
    p_partner_id:partnerId,p_stage:stage,p_next_followup:parsed.date
   });
   if(e)throw e;
   if(data?.real_payments_enabled!==false)throw Error('Confirmación inválida');
   setSaved(true);
  }catch{setError('No se pudo guardar el seguimiento.');}
  finally{setBusy(false);}
 }
 return <View style={{backgroundColor:'#172e46',padding:14,borderRadius:12,marginVertical:12}}>
  <Text style={{color:'white',fontSize:18,fontWeight:'700'}}>Seguimiento de posibles acuerdos</Text>
  <Text style={{color:'#ffdf9e',marginVertical:8}}>Solo seguimiento de conversaciones y documentos. No afirma que exista contrato, licencia ni banco asociado.</Text>
  {stages.map(([value,label])=><TouchableOpacity key={value} disabled={busy}
   accessibilityRole="button" onPress={()=>{setStage(value);setSaved(false);}}
   style={{backgroundColor:stage===value?'#167b75':'#314d65',padding:10,borderRadius:7,marginVertical:4}}>
    <Text style={{color:'white'}}>{stage===value?'✓ ':''}{label}</Text>
  </TouchableOpacity>)}
  <Text style={{color:'#c8dce7',marginTop:10}}>Próximo contacto (AAAA-MM-DD; opcional)</Text>
  <TextInput style={{backgroundColor:'#27475c',color:'white',padding:12,borderRadius:9,marginVertical:6}}
    accessibilityLabel="Fecha del próximo seguimiento" value={date} onChangeText={v=>{setDate(v);setSaved(false);}}
    placeholder="2027-01-15" placeholderTextColor="#adc5d3" autoCapitalize="none"/>
  {!!error&&<Text style={{color:'#ffa3a3'}}>{error}</Text>}
  {!!saved&&<Text style={{color:'#9df0ba'}}>Seguimiento guardado en Supabase.</Text>}
  <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={save}
   style={{backgroundColor:'#187c79',padding:13,borderRadius:9,marginTop:8}}>
   <Text style={{color:'white',textAlign:'center'}}>Guardar seguimiento interno</Text>
  </TouchableOpacity>
 </View>;
}
