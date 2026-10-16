// Lista interna de requisitos de candidatos. NO subir documentos ni datos sensibles.
import React,{useEffect,useState} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {parsePartnerExpiryDate} from './src/partner-expiry-dates.mjs';
const REQUIREMENTS={
legal_registration:'Constitución legal',
regulatory_license:'Licencia regulatoria',
jurisdiction_permissions:'Permisos por país',
signed_agreement:'Contrato de colaboración',
aml_kyc_program:'Programa AML/KYC',
sanctions_controls:'Control de sanciones',
consumer_protection:'Protección al consumidor',
data_security:'Seguridad de datos',
settlement_controls:'Controles de liquidación',
tax_reporting:'Obligaciones fiscales'
};
const STATES={
not_started:'No iniciado',requested:'Solicitado',
received_unverified:'Recibido, sin verificar',
needs_changes:'Requiere correcciones',
reviewed_internal:'Revisión interna (no autorizado)'
};
export default function PartnerComplianceReview({supabase,partnerId}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [dates,setDates]=useState({});
 const datedTypes=new Set(['regulatory_license','signed_agreement','jurisdiction_permissions']);
 function updateRows(data){const list=Array.isArray(data)?data:[];setRows(list);setDates(Object.fromEntries(list.map(r=>[r.requirement_type,r.valid_until||''])));}
 useEffect(()=>{
  let active=true;
  setRows([]);setDates({});setError('');
  if(!partnerId)return()=>{active=false;};
  supabase.rpc('mwd_owner_partner_due_diligence_demo',{p_partner_id:partnerId})
   .then(({data,error})=>{if(!active)return;if(error)setError('No se pudo leer la evaluación.');else updateRows(data);})
   .catch(()=>{if(active)setError('No se pudo consultar la evaluación.');});
  return()=>{active=false;};
 },[partnerId,supabase]);
 async function save(type,status){
  const dateText=(dates[type]||'').trim();
  const parsed=parsePartnerExpiryDate(datedTypes.has(type)?dateText:'');
  if(!parsed.valid){setError('Fecha inválida. Usa AAAA-MM-DD, por ejemplo 2027-12-31.');return;}
  if(status==='not_started'&&parsed.date){setError('Quita la fecha o selecciona otro estado distinto de No iniciado.');return;}
  if(busy)return;
  setBusy(true);setError('');
  try{
   const {error}=await supabase.rpc('mwd_owner_partner_due_diligence_save_demo',{
    p_partner_id:partnerId,p_requirement_type:type,p_review_status:status,p_valid_until:parsed.date
   });
   if(error)throw error;
   const response=await supabase.rpc('mwd_owner_partner_due_diligence_demo',{p_partner_id:partnerId});
   if(response.error)throw response.error;
   updateRows(response.data);
  }catch{setError('No se guardó el requisito; vuelve a intentarlo.');}
  finally{setBusy(false);}
 }
 return <View style={{backgroundColor:'#142d42',padding:12,borderRadius:12,marginVertical:10}}>
  <Text style={{color:'#fff',fontSize:18,fontWeight:'700'}}>Expediente de cumplimiento</Text>
  <Text style={{color:'#ffdc9f',marginVertical:10}}>Solo estados internos; no se verifica autenticidad, no se aprueban socios ni se habilitan pagos. No introduzcas información personal.</Text>
  {!!error&&<Text style={{color:'#ffa5a5'}}>{error}</Text>}
  {rows.map(r=><View key={r.requirement_type} style={{paddingVertical:12,borderBottomWidth:1,borderColor:'#35536a'}}>
   <Text style={{color:'#fff',fontWeight:'700'}}>{REQUIREMENTS[r.requirement_type]||r.requirement_type}</Text>
   <Text style={{color:'#c3d6e1',paddingVertical:5}}>{STATES[r.review_status]||r.review_status}</Text>
   {datedTypes.has(r.requirement_type)&&<View>
    <Text style={{color:'#c8dce7',marginTop:8}}>Fecha de vencimiento (AAAA-MM-DD; opcional)</Text>
    <TextInput accessibilityLabel={'Vencimiento '+(REQUIREMENTS[r.requirement_type]||r.requirement_type)}
      style={{backgroundColor:'#25465e',color:'white',padding:12,borderRadius:8,marginVertical:6}}
      autoCapitalize="none" autoCorrect={false} placeholder="2027-12-31" placeholderTextColor="#b8c9d8"
      value={dates[r.requirement_type]||''}
      onChangeText={v=>setDates(prev=>({...prev,[r.requirement_type]:v}))}/>
    <Text style={{color:'#aecada'}}>Fecha guardada: {r.valid_until||'No especificada'}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={busy}
      onPress={()=>save(r.requirement_type,r.review_status)}
      style={{backgroundColor:'#29776a',padding:11,borderRadius:8,marginVertical:5}}>
      <Text style={{color:'white',textAlign:'center'}}>Guardar fecha y estado actual</Text>
    </TouchableOpacity>
   </View>}
   {Object.entries(STATES).map(([key,label])=><TouchableOpacity key={key} disabled={busy||key===r.review_status}
     accessibilityRole="button" onPress={()=>save(r.requirement_type,key)}
     style={{backgroundColor:key===r.review_status?'#266b64':'#31516c',padding:9,borderRadius:8,marginVertical:3,opacity:busy?0.5:1}}>
     <Text style={{color:'white',textAlign:'center'}}>{key===r.review_status?'✓ ':''}{label}</Text>
   </TouchableOpacity>)}
  </View>)}
  {rows.length===0&&<Text style={{color:'#aac1d2'}}>Sin requisitos cargados todavía.</Text>}
 </View>;
}
