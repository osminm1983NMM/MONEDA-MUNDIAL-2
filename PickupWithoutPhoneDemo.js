// Prototipo de retiros sin telefono. SIN DINERO REAL.
import React,{useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const {pickupPendingStorageKeyDemo,serializePickupPendingDemo,deserializePickupPendingDemo}=require('./pickupPendingRules');
import {View,Text,TextInput,TouchableOpacity,Alert,Platform} from 'react-native';
const {parseDemoAmountCents,normalizeDemoCountry,verifiedClaimDemoFeedback,normalizePickupClaimDemo,validatePickupCreateReceiptDemo}=require('./pickupDemoRules');
const css={card:{padding:16,backgroundColor:'#142a45',borderRadius:12,marginVertical:10},title:{color:'#fff',fontWeight:'bold',fontSize:20,marginBottom:10},text:{color:'#dbe8f8',marginBottom:9},alert:{color:'#ffdc96',marginBottom:12},input:{backgroundColor:'#263c58',padding:12,color:'#fff',borderRadius:8,marginVertical:7},btn:{backgroundColor:'#2867e8',padding:12,borderRadius:8,marginVertical:6},btntxt:{color:'#fff',fontWeight:'bold',textAlign:'center'}};
function Btn({label,onPress,disabled}){return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[css.btn,disabled&&{opacity:.45}]}><Text style={css.btntxt}>{label}</Text></TouchableOpacity>;}
function uuid(){if(!globalThis.crypto?.getRandomValues)throw Error('Aleatoriedad segura no disponible');const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');}
function confirm(title,body,act){if(Platform.OS==='web'){if(window.confirm(title+'\n'+body))act();return;}Alert.alert(title,body,[{text:'No',style:'cancel'},{text:'Sí, simular',onPress:act}]);}
export default function PickupWithoutPhoneDemo({supabase,isOwner=false,userId}){
const [country,setCountry]=useState('NI'),[amount,setAmount]=useState('100'),[orders,setOrders]=useState([]),[ownerOrders,setOwnerOrders]=useState([]);
const [code,setCode]=useState(null),[selected,setSelected]=useState(''),[claim,setClaim]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[security,setSecurity]=useState(null);
const requestRef=useRef(null);
const [pendingReady,setPendingReady]=useState(false);
const [pendingNotice,setPendingNotice]=useState('');
const currentSession=useRef(userId);
currentSession.current=userId;
const key=pickupPendingStorageKeyDemo(userId);
async function load(){
 const [{data,error:e},admin]=await Promise.all([supabase.rpc('mwd_pickup_my_orders_demo'),isOwner?supabase.rpc('mwd_owner_pickup_orders_demo'):Promise.resolve(null)]);
 if(e)throw e;if(admin?.error)throw admin.error;setOrders(data||[]);if(admin){setOwnerOrders(admin.data||[]);const report=await supabase.rpc('mwd_owner_pickup_security_demo');if(report.error)throw report.error;setSecurity(report.data);}
}
useEffect(()=>{load().catch(e=>setError(e.message));},[supabase,isOwner,userId]);
useEffect(()=>{
 let active=true;
 requestRef.current={unavailable:true};setPendingReady(false);setPendingNotice('');
 (async()=>{
  if(!key)throw Error('Cuenta inválida');
  const raw=await AsyncStorage.getItem(key);
  if(!active||currentSession.current!==userId)return;
  const restored=raw?deserializePickupPendingDemo(raw):null;
  requestRef.current=raw&&!restored?{unavailable:true}:restored;
  if(raw&&!restored)setPendingNotice('Referencia local no verificable. Se bloquea la creación de nuevas solicitudes.');
  else if(restored){setCountry(restored.country);setAmount((restored.cents/100).toFixed(2));setPendingNotice('Solicitud anterior sin respuesta definitiva. Solo puedes reintentar con la MISMA referencia. El código secreto no se mostrará otra vez.');}
  setPendingReady(true);
 })().catch(()=>{
  if(active&&currentSession.current===userId){requestRef.current={unavailable:true};setPendingReady(true);setPendingNotice('No se pudo consultar la referencia guardada. Nuevas solicitudes bloqueadas.');}
 });
 return()=>{active=false;};
},[key,userId]);
async function create(){
 if(busy||!pendingReady||requestRef.current?.unavailable)return;setError('');setBusy(true);
 try{
 const cents=parseDemoAmountCents(amount),destination=normalizeDemoCountry(country);
 if(cents===null||destination===null)throw Error('Usa un país de dos letras y un importe de 1 a 1000');
 const signature=destination+'|'+cents;
 if(requestRef.current&&(requestRef.current.country!==destination||requestRef.current.cents!==cents))
   throw Error('Existe una solicitud de prueba con resultado incierto. No cambies la cantidad ni país hasta resolverla.');
 if(!requestRef.current){
  const newReq={signature,id:uuid(),country:destination,cents};
  const stored=serializePickupPendingDemo(newReq);
  if(!key||!stored)throw Error('No se pudo guardar una referencia segura.');
  await AsyncStorage.setItem(key,stored); // Nunca enviar sin registrar la referencia.
  if(currentSession.current!==userId)return;
  requestRef.current=newReq;
 }
 const req=requestRef.current;
 const {data,error:e}=await supabase.rpc('mwd_pickup_create_demo',{p_destination_country:destination,p_amount_cents:cents,p_request_id:req.id});
 if(e)throw e;
 const receipt=validatePickupCreateReceiptDemo(data,req);
 if(currentSession.current!==userId)return;
 if(!receipt)throw Error('Respuesta de creación no verificable. Se conserva la misma referencia.');
 await AsyncStorage.removeItem(key);
 if(currentSession.current!==userId)return;
 if(receipt.status==='created')setCode(receipt.pickupCode);
 else {setCode(null);setError('La solicitud ya existe. El código secreto no se vuelve a mostrar; consulta tus solicitudes.');}
 requestRef.current=null;setPendingNotice('');
 try{await load();}catch(e){setError('Solicitud reconocida; no se pudo actualizar el historial. Actualiza solicitudes.');}
 }catch(e){setError(e.message||'No se creó la orden');}
 finally{setBusy(false);}
}
async function cancel(orderId){if(busy)return;setBusy(true);setError('');try{const {error:e}=await supabase.rpc('mwd_pickup_cancel_demo',{p_order_id:orderId});if(e)throw e;await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
async function collect(){
 if(busy||!isOwner||!selected)return;setBusy(true);setError('');
 try{
 const validatedCode=normalizePickupClaimDemo(claim);
 if(!validatedCode)throw Error('Formato inválido. El código de prueba debe comenzar por SIM- y tener 32 caracteres hexadecimales. No se envió ningún intento.');
 const selectedOrderId=selected;
 const {data,error:e}=await supabase.rpc('mwd_owner_pickup_simulate_demo',{
  p_order_id:selectedOrderId,p_pickup_code:validatedCode
 });
 if(e)throw e;
 const outcome=verifiedClaimDemoFeedback(data,selectedOrderId);
 if(outcome.ok)setClaim('');
 else setError(outcome.message);
 await load();
 }catch(e){setError(e.message||'No se completó la simulación');}finally{setBusy(false);}
}
return <View style={css.card}>
 <Text style={css.title}>Entrega sin teléfono (DEMO)</Text>
 <Text style={css.alert}>No es una remesa. No reserva saldos, ni permite canjear códigos por dinero. No introduzcas datos personales ni documentos.</Text>
 <Text style={css.text}>País destino (NI, CR, HN...)</Text>
 <TextInput style={css.input} value={country} maxLength={2} autoCapitalize="characters" onChangeText={v=>{if(requestRef.current){setError('Solicitud incierta: conserva país e importe para reintentar con la misma referencia.');return;}setCountry(v);setCode(null);}}/>
 <Text style={css.text}>Importe ficticio expresado en USD</Text>
 <TextInput style={css.input} keyboardType="decimal-pad" value={amount} onChangeText={v=>{if(requestRef.current){setError('Solicitud incierta: conserva país e importe para reintentar con la misma referencia.');return;}setAmount(v);setCode(null);}}/>
 <Btn label={busy?'Procesando...':requestRef.current&&!requestRef.current.unavailable?'Consultar/reintentar MISMA referencia':'Generar código de PRUEBA'} disabled={busy||!pendingReady||!!requestRef.current?.unavailable} onPress={create}/>
 {!!pendingNotice&&<Text style={css.alert}>{pendingNotice}</Text>}
 {code&&<Text selectable style={css.alert}>CÓDIGO SIMULADO (se muestra una sola vez): {code}</Text>}
 {!!error&&<Text style={css.alert}>{error}</Text>}
 <Btn label="Actualizar solicitudes" disabled={busy} onPress={()=>load().catch(e=>setError(e.message))}/>
 <Text style={css.title}>Mis solicitudes</Text>
 {orders.length===0&&<Text style={css.text}>Sin solicitudes de prueba.</Text>}
 {orders.map(o=><View key={o.orderId} style={css.card}><Text style={css.text}>{o.destinationCountry} · {(o.amountCents/100).toFixed(2)} USD ficticios · {o.status}</Text><Text selectable style={css.text}>{o.orderId}</Text>{o.status==='pending'&&<Btn label="Cancelar" disabled={busy} onPress={()=>confirm('Cancelar demostración','No se moverá dinero.',()=>cancel(o.orderId))}/>}</View>)}
 {isOwner&&<View style={css.card}>
 <Text style={css.title}>Simulación de agente pagador (solo dueño)</Text>
 {ownerOrders.map(o=><Btn key={o.orderId} disabled={busy} label={o.destinationCountry+' · '+o.status+' · '+o.orderId.slice(0,8)} onPress={()=>{setSelected(o.orderId);setClaim('');setError('');}}/>)}
 <Text selectable style={css.text}>Orden seleccionada: {selected||'ninguna'}</Text>
 {security&&<Text style={css.alert}>Seguridad: {security.invalidAttemptsLastHour} intentos incorrectos en la última hora; {security.temporarilyBlockedOrders} órdenes bloqueadas temporalmente.</Text>}
 <TextInput style={css.input} value={claim} onChangeText={setClaim}
   placeholder="Código SIM-..." placeholderTextColor="#b5c7dc"
   accessibilityLabel="Código ficticio de retiro" autoCorrect={false}
   secureTextEntry={true} maxLength={36} autoCapitalize="characters"/>
 <Btn label="Registrar entrega FICTICIA" disabled={busy||!selected} onPress={()=>confirm('Simulación únicamente','No se entregará efectivo.',collect)}/>
 </View>}
</View>;
}
