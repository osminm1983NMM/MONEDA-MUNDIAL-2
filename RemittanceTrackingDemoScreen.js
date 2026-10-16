// Seguimiento administrativo de remesas ficticias, nunca pagos financieros.
// El backend comprueba rol del propietario, idempotencia y estados.
import React, {useEffect,useState,useRef} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';

const s={
 panel:{backgroundColor:'#182d46',padding:13,borderRadius:12,marginVertical:10},
 text:{color:'#d9e8f3',marginBottom:8},
 warning:{color:'#f5c87f',marginVertical:8},
 input:{color:'#fff',backgroundColor:'#283e59',padding:12,borderRadius:8,marginVertical:5},
 button:{backgroundColor:'#265da7',padding:12,borderRadius:10,marginVertical:5},
};
function Button({title,onPress,disabled=false}) {
 return <TouchableOpacity accessibilityRole="button" disabled={disabled}
  onPress={onPress} style={[s.button,disabled&&{opacity:0.4}]}>
  <Text style={{textAlign:'center',color:'#fff',fontWeight:'700'}}>{title}</Text>
 </TouchableOpacity>;
}
function randomId(){
 // La API requiere UUID por idempotencia, jamás representa un código de cobro.
 if(typeof globalThis.crypto?.randomUUID==='function') return globalThis.crypto.randomUUID();
 if(typeof globalThis.crypto?.getRandomValues!=='function') throw new Error('Aleatoriedad segura no disponible');
 const a=globalThis.crypto.getRandomValues(new Uint8Array(16));
 a[6]=(a[6]&15)|64; a[8]=(a[8]&63)|128;
 const x=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
 return [x.slice(0,8),x.slice(8,12),x.slice(12,16),x.slice(16,20),x.slice(20)].join('-');
}
export default function RemittanceTrackingDemoScreen({supabase}){
 const [orders,setOrders]=useState([]);
 const [selected,setSelected]=useState(null);
 const [events,setEvents]=useState([]);
 const [destination,setDestination]=useState('NI');
 const [amount,setAmount]=useState('100.00');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 // Se conserva el requestId del intento fallido para evitar registros duplicados.
 const requestRef=useRef(null);
 const busyRef=useRef(false);
 async function rpc(method,args){
  const {data,error:e}=await supabase.rpc(method,args);
  if(e)throw e;
  return data;
 }
 async function refresh(){
  const records=await rpc('mwd_owner_remittances_demo');
  setOrders(records||[]);
 }
 async function showEvents(id){
  setSelected(id);
  setEvents(await rpc('mwd_owner_remittance_events_demo',{p_order_id:id})||[]);
 }
 useEffect(()=>{
  let valid=true;
  supabase.rpc('mwd_owner_remittances_demo').then(({data,error:e})=>{
   if(!valid)return;
   if(e)setError(e.message);else setOrders(data||[]);
  }).catch(e=>{if(valid)setError(e.message)});
  return ()=>{valid=false};
 },[supabase]);
 async function execute(task){
  if(busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setNotice('');
  try{await task()}catch(e){setError((e?.message||'Error')+' · Comprueba el historial antes de reintentar.')}
  finally{busyRef.current=false;setBusy(false)}
 }
 function create(){
  execute(async()=>{
   if(!/^[A-Z]{2}$/.test(destination))throw new Error('Código de país inválido');
   if(!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(amount))throw new Error('Importe inválido');
   const cents=Math.round(Number(amount)*100);
   if(cents<100||cents>10000000)throw new Error('Importe entre 1 y 100,000 USD');
   const signature=destination+':'+cents;
   if(requestRef.current&&requestRef.current.signature!==signature)requestRef.current=null;
   if(!requestRef.current)requestRef.current={signature,id:randomId()};
   const result=await rpc('mwd_owner_remittance_create_demo',{
    p_destination_country:destination,p_amount_cents:cents,p_request_id:requestRef.current.id
   });
   requestRef.current=null;
   await refresh();await showEvents(result.id);
   setNotice(result.already_processed?'Intento recuperado sin duplicar':'Remesa ficticia registrada sin mover fondos');
  });
 }
 function transition(id,newStatus){
  execute(async()=>{
   const result=await rpc('mwd_owner_remittance_transition_demo',{
    p_order_id:id,p_new_status:newStatus,p_request_id:randomId()
   });
   await refresh();await showEvents(id);
   setNotice(result.already_processed?'Estado ya registrado':'Cambio ficticio registrado correctamente');
  });
 }
 return <View>
  <Text style={s.warning}>PANEL INTERNO • SOLO REMESAS FICTICIAS. Sin destinatarios reales, sin depósitos, sin códigos cobrables.</Text>
  {!!error&&<Text style={s.warning}>{error}</Text>}
  {!!notice&&<Text style={s.text}>{notice}</Text>}
  <View style={s.panel}>
   <Text style={s.text}>Crear orden de seguimiento simulada</Text>
   <Text style={s.text}>País ISO de destino (ejemplo: NI)</Text>
   <TextInput accessibilityLabel="País de destino" style={s.input} value={destination}
    autoCapitalize="characters" onChangeText={v=>{setDestination(v.toUpperCase());requestRef.current=null}} maxLength={2}/>
   <Text style={s.text}>Importe hipotético USD</Text>
   <TextInput accessibilityLabel="Cantidad ficticia" style={s.input} keyboardType="decimal-pad"
    value={amount} onChangeText={v=>{setAmount(v);requestRef.current=null}}/>
   <Button title={busy?'Procesando…':'Registrar remesa ficticia'} onPress={create} disabled={busy}/>
  </View>
  <View style={s.panel}>
   <Text style={s.text}>Seguimiento ficticio ({orders.length} más recientes)</Text>
   <Button title="Actualizar listado" disabled={busy} onPress={()=>execute(refresh)}/>
   {orders.map(o=><View key={o.id} style={s.panel}>
    <Text style={s.text}>{o.source_country} → {o.destination_country} · {(o.amount_cents/100).toFixed(2)} USD</Text>
    <Text style={s.text}>Estado de simulación: {o.status.toUpperCase()} · NO PAGADO</Text>
    <Button title="Consultar historial" disabled={busy} onPress={()=>execute(()=>showEvents(o.id))}/>
    {o.status==='draft'&&<Button title="Enviar a revisión ficticia" disabled={busy}
     onPress={()=>transition(o.id,'review')}/>}
    {o.status==='review'&&<Button title="Marcar simulación terminada (no pagada)" disabled={busy}
     onPress={()=>transition(o.id,'simulated')}/>}
    {['draft','review'].includes(o.status)&&<Button title="Cancelar simulación" disabled={busy}
     onPress={()=>transition(o.id,'cancelled')}/>}
   </View>)}
   {selected&&<View style={s.panel}>
    <Text style={s.text}>Auditoría de orden seleccionada</Text>
    {events.map((e,i)=><Text key={i} style={s.text}>{e.from_status||'nuevo'} → {e.to_status} · {e.event_type}</Text>)}
   </View>}
  </View>
  <Text style={s.warning}>No existe una liquidación real, confirmación bancaria ni un beneficiario autorizado. Ninguna acción envía dinero.</Text>
 </View>;
}
