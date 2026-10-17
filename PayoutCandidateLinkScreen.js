// Vinculación administrativa de remesas de prueba con sucursales candidatas.
// CERO pagos reales. Sólo el servidor permite los cambios de simulación.
import React,{useEffect,useState,useRef} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {canCloseMockPayout,isSafeMockPayoutClosureResponse,isVerifiedMockPayoutCapability} from './src/payout-demo-closure-guards.mjs';
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
 const [codeSummary,setCodeSummary]=useState(null);
 const [oneTimeCode,setOneTimeCode]=useState('');
 const [codeInput,setCodeInput]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [serverCapability,setServerCapability]=useState(false);
 const inFlight=useRef(false);
 const pending=useRef(null);
 const closePending=useRef(null);
 async function rpc(name,params){const {data,error:e}=await supabase.rpc(name,params);if(e)throw e;return data;}
 async function run(callback){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{await callback()}catch(e){setError((e?.message||'Error')+' · Consulta el estado antes de reintentar.')}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function checkCapability(){
  try{const response=await rpc('mwd_demo_payout_closure_capability');
    setServerCapability(isVerifiedMockPayoutCapability(response));
  }catch(_){setServerCapability(false);}
 }
 async function reload(){
  const [o,p]=await Promise.all([rpc('mwd_owner_remittances_demo'),rpc('mwd_owner_partners_demo')]);
  setOrders(o||[]);setPartners(p||[]);
  await checkCapability();
 }
 useEffect(()=>{let mounted=true;
  checkCapability();
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
  setOrderId(id);setPartnerId('');setLocationId('');setBranches([]);setSummary(null);
  setCodeInput('');setOneTimeCode('');setCodeSummary(null);pending.current=null;closePending.current=null;
  await readSummary(id);await readCodeSummary(id);
 }
 async function readSummary(id){setSummary(await rpc('mwd_owner_payout_design_summary_demo',{p_order_id:id}));}
 async function readCodeSummary(id){setCodeSummary(await rpc('mwd_owner_pickup_code_summary_demo',{p_order_id:id}));}
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
 function issue(){run(async()=>{
  if(!orderId)throw Error('Selecciona una remesa');
  const signature='issue:'+orderId;
  if(!pending.current||pending.current.signature!==signature)pending.current={signature,id:nextRequestId()};
  const res=await rpc('mwd_owner_issue_pickup_code_demo',{p_order_id:orderId,p_request_id:pending.current.id});
  pending.current=null;setOneTimeCode(res.demo_code_once||'');
  await readCodeSummary(orderId);
  setNotice('Código DEMO generado una sola vez; NO es válido en bancos y no se puede cobrar.');
 });}
 function mockIdentity(){run(async()=>{
  await rpc('mwd_owner_mock_beneficiary_check_demo',{p_order_id:orderId,p_request_id:nextRequestId()});
  await readCodeSummary(orderId);setNotice('Comprobación de identidad SIMULADA, no verifica personas reales.');
 });}
 function tryCode(){run(async()=>{
  const signature='try:'+orderId+':'+codeInput;
  if(!pending.current||pending.current.signature!==signature)pending.current={signature,id:nextRequestId()};
  const res=await rpc('mwd_owner_try_pickup_code_demo',{
   p_order_id:orderId,p_demo_code:codeInput.trim(),p_request_id:pending.current.id
  });
  pending.current=null;setCodeInput('');setOneTimeCode('');await readCodeSummary(orderId);
  setNotice('Estado del ensayo: '+res.status+'. DINERO ENTREGADO: 0.');
 });}
 function closeMockPayout(){run(async()=>{
  await checkCapability();
  const capability=await rpc('mwd_demo_payout_closure_capability').catch(()=>null);
  if(!isVerifiedMockPayoutCapability(capability)) throw Error('Servidor DEMO sin cierre seguro instalado');
  if(!canCloseMockPayout({orderStatus:order?.status,assignmentStatus:summary?.status,
     codeStatus:codeSummary?.status,identityCheckSimulated:codeSummary?.identity_check_simulated})){
    throw Error('Primero consume un código ficticio válido tras la revisión SIMULADA de identidad');
  }
  if(!closePending.current||closePending.current.orderId!==orderId){
    closePending.current={orderId,id:nextRequestId()};
  }
  const response=await rpc('mwd_owner_complete_payout_sample_demo',
     {p_order_id:orderId,p_request_id:closePending.current.id});
  if(!isSafeMockPayoutClosureResponse(response)){
    throw Error('Respuesta del servidor no válida para cierre de simulación; no se acredita ningún pago');
  }
  closePending.current=null;
  await readSummary(orderId);
  await readCodeSummary(orderId);
  setNotice('Cierre de ensayo completado. Pago bancario o efectivo: 0.');
 });}
 function cancelCode(){run(async()=>{
  await rpc('mwd_owner_cancel_pickup_code_demo',{p_order_id:orderId});
  setCodeInput('');setOneTimeCode('');await readCodeSummary(orderId);
  setNotice('Código ficticio cancelado y no utilizable.');
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
   {summary?.status==='planned'&&order.status==='simulated'&&<View style={style.card}>
     <Text style={style.warning}>VERIFICACIÓN DE BENEFICIARIO Y CÓDIGO • SOLO FICTICIA</Text>
     <Text style={style.text}>Estado del código: {codeSummary?.status||'consultando'}</Text>
     {codeSummary?.status==='not_issued'&&
       <Btn title="Emitir código DEMO de 30 minutos (no cobrable)" disabled={busy} onPress={issue}/>}
     {!!oneTimeCode&&<Text selectable style={style.warning}>CÓDIGO DE MUESTRA · NO COBRABLE: {oneTimeCode}</Text>}
     {codeSummary?.status==='active'&&<View>
       <Text style={style.text}>Intentos restantes: {codeSummary.remaining_attempts}. La verificación de identidad REAL no está disponible.</Text>
       {!codeSummary.identity_check_simulated&&
         <Btn title="Simular revisión de identidad (NO verifica a nadie)" disabled={busy} onPress={mockIdentity}/>}
       <TextInput accessibilityLabel="Código ficticio de demostración" value={codeInput}
         onChangeText={setCodeInput} placeholder="DEMO-..."
         autoCapitalize="characters" style={{backgroundColor:'#28455e',color:'white',padding:11}}/>
       <Btn title="Probar código y anular muestra (sin pagar)" disabled={busy||!codeInput.trim()} onPress={tryCode}/>
       <Btn title="Cancelar código de muestra" disabled={busy} onPress={cancelCode}/>
     </View>}
     {codeSummary?.status==='consumed'&&<Text style={style.warning}>Código consumido una sola vez. No hubo entrega de dinero.</Text>}
     {serverCapability&&canCloseMockPayout({orderStatus:order.status,assignmentStatus:summary?.status,
       codeStatus:codeSummary?.status,identityCheckSimulated:codeSummary?.identity_check_simulated})&&
       <Btn title="Cerrar simulación (NO entregar dinero)" disabled={busy} onPress={closeMockPayout}/>}

     {['expired','cancelled','locked'].includes(codeSummary?.status)&&
      <Text style={style.warning}>Código cerrado: {codeSummary.status}. No se puede utilizar.</Text>}
   </View>}
   {summary?.status!=='unassigned'&&<Text style={style.text}>
     Sucursal asociada: {summary?.location_name||'—'} · Estado: {summary?.status||'—'}
   </Text>}
   {!serverCapability&&summary?.status==='planned'&&<Text style={style.warning}>Cierre de simulación deshabilitado hasta verificar la actualización segura del servidor.</Text>}
   {summary?.status==='sample_completed'&&
     <Text style={style.warning}>Ensayo terminado. Bloqueado contra segundo retiro. Fondos pagados: 0.</Text>}
  </View>}
  {!!notice&&<Text style={style.text}>{notice}</Text>}
  {!!error&&<Text style={style.warning}>{error}</Text>}
  <Text style={style.warning}>Todos los candidatos son de planificación. “Documentado” nunca significa contratado o autorizado.</Text>
 </View>;
}
