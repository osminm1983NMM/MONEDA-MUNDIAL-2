// Vinculación administrativa de remesas de prueba con sucursales candidatas.
// CERO pagos reales. Sólo el servidor permite los cambios de simulación.
import React,{useEffect,useState,useRef} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
const style={
 card:{backgroundColor:'#182d46',padding:14,borderRadius:11,marginVertical:8},
 text:{color:'#dce9f5',marginVertical:6},
 warning:{color:'#f5cb88',marginVertical:8},
 button:{backgroundColor:'#255f9e',padding:12,borderRadius:9,marginVertical:5},
};
function Btn({title,onPress,disabled}){return <TouchableOpacity accessibilityRole="button" disabled={disabled}
 onPress={onPress} style={[style.button,disabled&&{opacity:.45}]}><Text style={{color:'#fff',textAlign:'center'}}>{title}</Text></TouchableOpacity>}
function nextRequestId(){
 const c=globalThis.crypto;if(typeof c?.randomUUID==='function')return c.randomUUID();
 if(typeof c?.getRandomValues!=='function')throw Error('Generador seguro no disponible');
 const bytes=c.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
export default function PayoutCandidateLinkScreen({supabase}){
 const [orders,setOrders]=useState([]);
 const [partners,setPartners]=useState([]);
 const [branches,setBranches]=useState([]);
 const [orderId,setOrderId]=useState('');
 const [partnerId,setPartnerId]=useState('');
 const [locationId,setLocationId]=useState('');
 const [summary,setSummary]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const inFlight=useRef(false);
 const pending=useRef(null);
 async function rpc(name,params){const {data,error:e}=await supabase.rpc(name,params);if(e)throw e;return data;}
 async function run(callback){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{await callback()}catch(e){setError((e?.message||'Error')+' · Consulta el estado antes de reintentar.')}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function reload(){
  const [o,p]=await Promise.all([rpc('mwd_owner_remittances_demo'),rpc('mwd_owner_partners_demo')]);
  setOrders(o||[]);setPartners(p||[]);
 }
 useEffect(()=>{let mounted=true;
  Promise.all([supabase.rpc('mwd_owner_remittances_demo'),supabase.rpc('mwd_owner_partners_demo')])
  .then(results=>{if(!mounted)return;const e=results.find(r=>r.error);if(e)throw e.error;
   setOrders(results[0].data||[]);setPartners(results[1].data||[]);
  }).catch(e=>{if(mounted)setError(e.message||'Error de consulta')});
  return ()=>{mounted=false};
 },[supabase]);
 const order=orders.find(o=>o.id===orderId);
 const eligible=partners.filter(p=>p.review_status==='documented'&&p.country_code===order?.destination_country);
 const selectedPartner=eligible.find(p=>p.id===partnerId);
 async function chooseOrder(id){
  setOrderId(id);setPartnerId('');setLocationId('');setBranches([]);setSummary(null);pending.current=null;
  await readSummary(id);
 }
 async function readSummary(id){setSummary(await rpc('mwd_owner_payout_design_summary_demo',{p_order_id:id}));}
 async function choosePartner(id){
  setPartnerId(id);setLocationId('');pending.current=null;
  setBranches(await rpc('mwd_owner_partner_locations_demo',{p_partner_id:id})||[]);
 }
 function assign(){run(async()=>{
  if(!order||!selectedPartner||!locationId)throw Error('Selecciona remesa, socio y sucursal');
  const signature=[orderId,partnerId,locationId].join(':');
  if(!pending.current||pending.current.signature!==signature)pending.current={signature,id:nextRequestId()};
  const res=await rpc('mwd_owner_assign_payout_design_demo',{
   p_order_id:orderId,p_partner_id:partnerId,p_location_id:locationId,
   p_request_id:pending.current.id
  });
  pending.current=null;await readSummary(orderId);
  setNotice(res.already_processed?'Asignación ficticia ya registrada':'Sucursal candidata asociada; ningún dinero fue enviado');
 });}
 function finish(){run(async()=>{
  if(!orderId)throw Error('Selecciona la remesa');
  const signature='finish:'+orderId;
  if(!pending.current||pending.current.signature!==signature)pending.current={signature,id:nextRequestId()};
  const res=await rpc('mwd_owner_complete_payout_sample_demo',{p_order_id:orderId,p_request_id:pending.current.id});
  pending.current=null;await readSummary(orderId);await reload();
  setNotice(res.already_processed?'Ensayo ya completado':'Ensayo de entrega marcado, SIN cobro real');
 });}
 return <View style={style.card}>
  <Text style={style.warning}>ASOCIACIÓN DEMO DE AGENTES · SIN FONDOS NI CÓDIGOS COBRABLES</Text>
  <Text style={style.text}>Selecciona una remesa de prueba</Text>
  <Btn title="Actualizar pedidos" onPress={()=>run(reload)} disabled={busy}/>
  {orders.filter(o=>['review','simulated'].includes(o.status)).map(o=><Btn key={o.id}
    title={(orderId===o.id?'✓ ':'')+o.destination_country+' · '+(o.amount_cents/100).toFixed(2)+' USD · '+o.status}
    disabled={busy} onPress={()=>run(()=>chooseOrder(o.id))}/>)}
  {!!order&&<View>
   <Text style={style.text}>Candidatos documentados del país {order.destination_country} (no autorizados)</Text>
   {eligible.map(p=><Btn key={p.id} title={(partnerId===p.id?'✓ ':'')+p.legal_name}
    disabled={busy||summary?.status!=='unassigned'} onPress={()=>run(()=>choosePartner(p.id))}/>)}
   {!eligible.length&&<Text style={style.warning}>No existen candidatos documentados en ese país.</Text>}
   {!!selectedPartner&&<View>
    <Text style={style.text}>Sucursales de diseño y moneda hipotética</Text>
    {branches.map(l=><Btn key={l.id} title={(locationId===l.id?'✓ ':'')+l.display_name+' · '+l.city+' · '+l.currency_code}
      disabled={busy||summary?.status!=='unassigned'} onPress={()=>{setLocationId(l.id);pending.current=null}}/>)}
   </View>}
   {summary?.status==='unassigned'&&order.status==='review'&&
    <Btn title="Asociar sucursal candidata (sin pagar)" disabled={busy||!locationId} onPress={assign}/>}
   {summary?.status==='planned'&&order.status==='simulated'&&
    <Btn title="Finalizar ensayo ficticio (NO PAGAR)" disabled={busy} onPress={finish}/>}
   {summary?.status!=='unassigned'&&<Text style={style.text}>
     Sucursal asociada: {summary?.location_name||'—'} · Estado: {summary?.status||'—'}
   </Text>}
   {summary?.status==='sample_completed'&&
     <Text style={style.warning}>Ensayo terminado. Bloqueado contra segundo retiro. Fondos pagados: 0.</Text>}
  </View>}
  {!!notice&&<Text style={style.text}>{notice}</Text>}
  {!!error&&<Text style={style.warning}>{error}</Text>}
  <Text style={style.warning}>Todos los candidatos son de planificación. “Documentado” nunca significa contratado o autorizado.</Text>
 </View>;
}
