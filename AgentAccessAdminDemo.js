// Administracion de AGENTES SOLO LECTURA para simulacion. Sin pagos.
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,Alert} from 'react-native';
const s={box:{padding:14,backgroundColor:'#182d46',borderRadius:12,marginVertical:15},title:{fontSize:19,color:'white',fontWeight:'700',marginBottom:9},text:{color:'#d6e6f8',marginBottom:7},warn:{color:'#ffcf90',marginBottom:12},field:{color:'white',backgroundColor:'#283f5b',padding:12,borderRadius:9,marginBottom:10},btn:{backgroundColor:'#2867df',padding:12,borderRadius:9,marginBottom:8},btntxt:{color:'white',fontWeight:'bold',textAlign:'center'}};
const B=({label,onPress,disabled})=><TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={disabled} style={[s.btn,disabled&&{opacity:.4}]}><Text style={s.btntxt}>{label}</Text></TouchableOpacity>;
export default function AgentAccessAdminDemo({supabase}){
 const [partners,setPartners]=useState([]),[assignments,setAssignments]=useState([]),[audit,setAudit]=useState([]),[partnerId,setPartnerId]=useState(''),[userId,setUserId]=useState(''),[reason,setReason]=useState(''),[days,setDays]=useState('14'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){
  const req=await Promise.all(['mwd_owner_partners_demo','mwd_owner_agent_list_demo','mwd_owner_agent_audit_demo'].map(name=>supabase.rpc(name)));
  const bad=req.find(x=>x.error);if(bad)throw bad.error;
  setPartners(req[0].data||[]);setAssignments(req[1].data||[]);setAudit(req[2].data||[]);
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[supabase]);
 async function change(action){
  if(busy)return;setBusy(true);setError('');
  try{
   const {error:e}=await supabase.rpc('mwd_owner_agent_access_demo',{p_user_id:userId.trim(),p_partner_id:partnerId,p_action:action,p_reason:reason.trim(),p_valid_days:Number(days)});
   if(e)throw e;await refresh();setReason('');
  }catch(e){setError(e.message||'No se pudo cambiar la asignacion');}finally{setBusy(false);}
 }
 return <View style={s.box}>
  <Text style={s.title}>Agentes candidatos — control DEMO</Text>
  <Text style={s.warn}>Estas asignaciones NO autorizan remesas, revisiones de identidad ni retiros. Son permisos de consulta de alcance para pruebas.</Text>
  {!!error&&<Text style={s.warn}>{error}</Text>}
  <Text style={s.text}>Seleccionar institucion candidata</Text>
  {partners.map(p=><B key={p.id} disabled={busy} label={(partnerId===p.id?'✓ ':'')+p.legal_name+' ('+p.country_code+')'} onPress={()=>setPartnerId(p.id)}/>)}
  <Text style={s.text}>ID de cuenta de prueba (UUID, nunca contraseña)</Text>
  <TextInput style={s.field} value={userId} onChangeText={setUserId} autoCapitalize="none"/>
  <Text style={s.text}>Dias de vigencia (1–30)</Text>
  <TextInput style={s.field} value={days} onChangeText={setDays} keyboardType="number-pad"/>
  <Text style={s.text}>Motivo de auditoria (10–200 caracteres)</Text>
  <TextInput style={s.field} value={reason} onChangeText={setReason}/>
  {['enable','suspend','revoke'].map(action=><B key={action} disabled={busy||!partnerId||!userId.trim()||reason.trim().length<10} label={{enable:'Activar consulta ficticia',suspend:'Suspender permiso',revoke:'Revocar permiso'}[action]} onPress={()=>Alert.alert('Permiso de prueba',action+' — no autoriza pagos.',[{text:'Cancelar',style:'cancel'},{text:'Confirmar',onPress:()=>change(action)}])}/>)}
  <B label="Actualizar permisos" disabled={busy} onPress={()=>refresh().catch(e=>setError(e.message))}/>
  <Text style={s.title}>Permisos registrados ({assignments.length})</Text>
  {assignments.map(a=><Text key={a.assignmentId} style={s.text}>{a.partnerName} · {a.country} · {a.status} · {a.accessNow?'vigente':'sin acceso'} · usuario {a.userId?.slice(0,8)}…</Text>)}
  <Text style={s.title}>Auditoria ({audit.length})</Text>
  {audit.slice(0,20).map(e=><Text key={e.eventId} style={s.text}>{e.after} · {new Date(e.at).toLocaleString()} · {e.reason}</Text>)}
 </View>;
}
