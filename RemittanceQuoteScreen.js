import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet} from 'react-native';
import {centsFromInput,parseCountries,parseQuote,makeRequestGate} from './remittance-quote';

const usd=cents=>(cents/100).toFixed(2)+' USD';
function Button({label,onPress,disabled=false,selected=false}){
 return <TouchableOpacity accessibilityRole="button" accessibilityState={{disabled,selected}}
  disabled={disabled} onPress={onPress} style={[s.button,selected&&s.selected,disabled&&s.disabled]}>
  <Text style={s.buttonText}>{label}</Text>
 </TouchableOpacity>;
}
export default function RemittanceQuoteScreen({supabase,isActive}){
 const [countries,setCountries]=useState([]),[country,setCountry]=useState('HN');
 const [method,setMethod]=useState('bank'),[amount,setAmount]=useState('');
 const [quote,setQuote]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const gate=useRef(makeRequestGate()).current;
 const activeRef=useRef(isActive);activeRef.current=isActive;
 const valid=token=>gate.isLatest(token)&&activeRef.current();
 function invalidate(){gate.invalidate();setBusy(false);setQuote(null);setError('');}
 async function load(){
  if(!activeRef.current())return;
  const token=gate.begin();if(token===null)return;
  setBusy(true);setError('');setQuote(null);setCountries([]);
  try{
   const {data,error}=await supabase.rpc('mwd_world_countries_demo');
   if(!valid(token))return;
   if(error)throw error;
   const available=parseCountries(data);setCountries(available);
   setCountry(available.find(c=>c.code==='HN')?.code||available[0].code);
  }catch{if(valid(token))setError('No se pudieron consultar los destinos de prueba.');}
  finally{if(gate.finish(token)&&activeRef.current())setBusy(false);}
 }
 useEffect(()=>{load();return()=>gate.invalidate();},[]);
 async function calculate(){
  if(!activeRef.current())return;
  const cents=centsFromInput(amount);
  if(cents===null){setQuote(null);setError('Introduce entre 1.00 y 100,000.00 USD, con hasta dos decimales.');return;}
  if(!countries.some(c=>c.code===country)||!['bank','card'].includes(method)){setQuote(null);setError('Selecciona un destino y método disponibles.');return;}
  const token=gate.begin();if(token===null)return;
  const expected={country,method,cents};
  setBusy(true);setQuote(null);setError('');
  try{
   const {data,error}=await supabase.rpc('mwd_quote_international_demo',{p_destination_country:country,p_amount_cents:cents,p_method:method});
   if(!valid(token))return;
   if(error)throw error;
   setQuote(parseQuote(data,expected));
  }catch{if(valid(token))setError('No se pudo obtener una cotización válida. Reintenta.');}
  finally{if(gate.finish(token)&&activeRef.current())setBusy(false);}
 }
 return <View style={s.card}>
  <Text style={s.heading}>Cotizar remesa internacional</Text>
  <Text style={s.warning}>SIMULACIÓN • NO ENVÍA DINERO • SIN TIPO DE CAMBIO REAL</Text>
  <Text style={s.text}>Origen: Estados Unidos (USD). Selecciona un destino de prueba disponible.</Text>
  {!countries.length&&<Button label={busy?'Consultando...':'Consultar destinos'} disabled={busy} onPress={load}/>}
  {countries.map(c=><Button key={c.code} label={c.name+' ('+c.code+')'} selected={country===c.code} disabled={busy} onPress={()=>{invalidate();setCountry(c.code);}}/>)}
  <Text style={s.text}>Método de origen (simulado)</Text>
  <Button label="Cuenta bancaria" selected={method==='bank'} disabled={busy} onPress={()=>{invalidate();setMethod('bank');}}/>
  <Button label="Tarjeta" selected={method==='card'} disabled={busy} onPress={()=>{invalidate();setMethod('card');}}/>
  <TextInput style={s.input} accessibilityLabel="Monto en dólares" placeholder="Monto USD" placeholderTextColor="#9fb1c8" keyboardType="decimal-pad" editable={!busy} value={amount} onChangeText={v=>{invalidate();setAmount(v);}}/>
  <Button label={busy?'Consultando...':'Calcular cotización ficticia'} disabled={busy||!countries.length} onPress={calculate}/>
  {!!error&&<Text accessibilityLiveRegion="polite" style={s.warning}>{error}</Text>}
  {!!quote&&<View style={s.result}>
   <Text style={s.heading}>Resultado ilustrativo</Text>
   <Text style={s.text}>Monto: {usd(quote.amountCents)}</Text>
   <Text style={s.text}>Comisión simulada: {usd(quote.feeCents)}</Text>
   <Text style={s.total}>Total ilustrativo: {usd(quote.totalPayCents)}</Text>
   <Text style={s.text}>Moneda de destino: {quote.destinationCurrency}</Text>
   <Text style={s.text}>{quote.receiverAmountCents===null?'Monto a recibir y tipo de cambio no disponibles en DEMO.':'Monto ilustrativo a recibir: '+usd(quote.receiverAmountCents)}</Text>
   <Text style={s.warning}>No es una orden de pago. No cambia tu saldo.</Text>
  </View>}
 </View>;
}
const s=StyleSheet.create({card:{backgroundColor:'#13253e',borderRadius:17,padding:20,marginBottom:17},heading:{color:'#fff',fontSize:21,fontWeight:'700',marginBottom:13},text:{color:'#d4e0f1',fontSize:15,marginBottom:9},warning:{color:'#f4cc81',fontSize:13,marginVertical:10},input:{backgroundColor:'#233a58',color:'#fff',padding:14,borderRadius:11,marginVertical:8,fontSize:16},button:{backgroundColor:'#334b68',padding:13,borderRadius:10,marginBottom:7},selected:{backgroundColor:'#276af1'},disabled:{opacity:0.5},buttonText:{color:'#fff',fontWeight:'700',textAlign:'center'},result:{marginTop:12,padding:12,backgroundColor:'#07111f',borderRadius:12},total:{color:'#fff',fontSize:19,fontWeight:'700',marginVertical:8}});
