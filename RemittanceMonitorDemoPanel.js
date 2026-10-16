import React,{useState,useEffect,useRef} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {summarizeRemittanceMonitor} from './src/admin/remittance-monitor-demo.mjs';
import {canApplySessionResponse} from './src/session-guards.mjs';
export default function RemittanceMonitorDemoPanel({supabase}){
 const [data,setData]=useState(null),[country,setCountry]=useState(''),
 [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const sequence=useRef(0),live=useRef(false);
 async function refresh(){
  const number=++sequence.current;
  setBusy(true);setError('');setData(null);
  try{
   const start=await supabase.auth.getSession(), userId=start.data?.session?.user?.id;
   if(!userId)throw Error('No hay sesión de propietario');
   const {data:rows,error:dbError}=await supabase.rpc('mwd_owner_remittance_monitor_demo',
    {p_country_code:country||null,p_limit:50});
   if(dbError)throw dbError;
   const end=await supabase.auth.getSession();
   if(!canApplySessionResponse(userId,end.data?.session))throw Error('Sesión cambiada');
   if(live.current&&number===sequence.current)setData(summarizeRemittanceMonitor(rows));
  }catch(e){if(live.current&&number===sequence.current)setError(
   e?.code==='PGRST202'||e?.code==='42883'?'Consulta de monitor aún no instalada':
   e?.code==='42501'?'Acceso exclusivo del propietario':
   'No se pudo consultar el monitor de remesas ficticias.');}
  finally{if(live.current&&number===sequence.current)setBusy(false);}
 }
 useEffect(()=>{live.current=true;refresh();return()=>{live.current=false;sequence.current++;};},[supabase]);
 const text={color:'#deebf3',marginVertical:4};
 return <View style={{backgroundColor:'#10293c',padding:14,borderRadius:12,marginBottom:15}}>
  <Text style={{color:'white',fontSize:19,fontWeight:'800'}}>Supervisión internacional · DEMO</Text>
  <Text style={{color:'#ffda97',marginVertical:8}}>Solo remesas ficticias; sin beneficiarios, códigos en claro ni pagos bancarios.</Text>
  <TextInput accessibilityLabel="País de destino" placeholder="País: NI, HN, CR..." placeholderTextColor="#aabccd"
   value={country} onChangeText={x=>setCountry(x.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2))}
   autoCapitalize="characters" maxLength={2}
   style={{backgroundColor:'#30475c',color:'white',padding:12,borderRadius:8}}/>
  <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={refresh}
   style={{backgroundColor:'#187a77',padding:13,borderRadius:8,marginVertical:9}}>
   <Text style={{color:'white',textAlign:'center'}}>{busy?'Consultando...':'Actualizar supervisión'}</Text>
  </TouchableOpacity>
  {!!error&&<Text style={{color:'#ffaaaa'}}>{error}</Text>}
  {data&&<View>
   <Text style={text}>Órdenes consultadas (máximo 50): {data.total} · Revisar: {data.needsReview} · Códigos vencidos: {data.expired}</Text>
   <Text style={text}>Simulaciones canceladas: {data.cancelled}</Text>
   {data.rows.map(row=><View key={row.id} style={{borderTopWidth:1,borderColor:'#39576b',paddingVertical:9}}>
    <Text style={{color:'white',fontWeight:'700'}}>{row.source} → {row.country} · USD {(row.amountCents/100).toFixed(2)} ficticios</Text>
    <Text style={text}>Orden: {row.status} · Sucursal: {row.assignment} · Código: {row.pickup}</Text>
    <Text style={{color:'#ffdba5'}}>Revisión: {row.attention} · Fallos: {row.failures} · Alertas: {row.anomalyCount}</Text>
   </View>)}
   {!data.rows.length&&<Text style={text}>Todavía no hay órdenes ficticias para mostrar.</Text>}
   <Text style={{color:'#ffdba5'}}>Transferencias reales: DESHABILITADAS. Consulta de solo lectura.</Text>
  </View>}
 </View>;
}
