import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,ScrollView,StyleSheet} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {fetch as expoFetch} from 'expo/fetch';
import {createClient} from '@supabase/supabase-js';
const {createRemittanceStatusHost}=require('./financial-sandbox/mobile/remittance-status-host.js');
const {createRemittanceStatusPanel}=require('./financial-sandbox/mobile/remittance-status-panel.js');
const {createOrderStatusClient}=require('./financial-sandbox/order-status-client.cjs');
const {createExpoPortfolio}=require('./financial-sandbox/mobile/digital-coin-portfolio-expo.js');
const {createPortfolioClient}=require('./financial-sandbox/digital-coin-portfolio-client.cjs');
const {createHostedSessionFence}=require('./financial-sandbox/mobile/hosted-session-fence.js');
const Native=require('react-native');
const Panel=createRemittanceStatusPanel(React,Native);
const origin='https://tfamyuqqpenilnovqjpp.supabase.co';
// Public project key, never a secret/service_role key. Only this sandbox.
const publishableKey="sb_publishable_NesVIbsf44Dhb41k1CzRkA_il-cO3Fe";
const initial={enabled:false,orderId:null,locale:'es',view:{state:'signed_out'},selectionRevision:0};
// A UI deadline also handles transports that ignore cancellation. Late sign-ins
// are never published and their local session is explicitly revoked if possible.
async function authDeadline(operation,onLate=()=>{},ms=15000){
 let expired=false,timer;
 const task=Promise.resolve().then(operation);
 const observed=task.then(value=>{
  if(expired)void Promise.resolve().then(()=>onLate(value)).catch(()=>{});
  return value;
 });
 try{return await Promise.race([observed,new Promise((_,reject)=>{
  timer=setTimeout(()=>{expired=true;reject(Error('AUTH_DEADLINE'));},ms);
 })]);}finally{clearTimeout(timer);}
}
function Lab(){
 const [state,setState]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[order,setOrder]=useState('');
 const [signed,setSigned]=useState(false),[busy,setBusy]=useState(false),[info,setInfo]=useState('');
 const [,setWalletView]=useState(null);
 const wallet=useRef(null),host=useRef(null),auth=useRef(null),revision=useRef(0),pending=useRef(false),mounted=useRef(false),fence=useRef(null);
 useEffect(()=>{
  mounted.current=true;
  fence.current=createHostedSessionFence(()=>{
   if(!mounted.current)return;
   revision.current++;pending.current=false;
   const old=auth.current;auth.current=null;
   host.current?.setSession(null);wallet.current?.setSession(null);
   setSigned(false);setBusy(false);setOrder('');setPassword('');
   setInfo('No se pudo autorizar una consulta de laboratorio. Inicia sesión nuevamente.');
   if(old)void old.auth.signOut({scope:'local'}).catch(()=>{});
  });
  host.current=createRemittanceStatusHost({environment:'sandbox',enabled:true,sandboxOrigin:origin,transport:'hosted-rpc',publishableKey,expoFetch,locale:'es',onChange:next=>{if(mounted.current){setState(next);fence.current?.observe('remittance',next.view);}}});
  wallet.current=createExpoPortfolio({React,Native,environment:'sandbox',enabled:true,sandboxOrigin:origin,transport:'hosted-snapshot',publishableKey,expoFetch,onChange:next=>{if(mounted.current){setWalletView(next);fence.current?.observe('wallet',next);}}});
  return ()=>{mounted.current=false;fence.current?.disarm();fence.current=null;wallet.current?.dispose();wallet.current=null;revision.current++;pending.current=false;host.current?.dispose();host.current=null;const old=auth.current;auth.current=null;if(old)void old.auth.signOut({scope:'local'}).catch(()=>{});};
 },[]);
 async function login(){
  if(pending.current||!host.current||!wallet.current||signed||!email.trim()||!password)return;
  pending.current=true;setBusy(true);setInfo('');setOrder('');
  const request=++revision.current,secret=password;setPassword('');
  let client;
  try{
   client=createClient(origin,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   auth.current=client;
   const {data,error}=await authDeadline(()=>client.auth.signInWithPassword({email:email.trim(),password:secret}),()=>client.auth.signOut({scope:'local'}));
   if(!mounted.current||revision.current!==request){void client.auth.signOut({scope:'local'}).catch(()=>{});return;}
   const token=data?.session?.access_token;
   if(error||typeof token!=='string'||!/^[A-Za-z0-9._~-]{1,8192}$/.test(token)||data?.user?.is_anonymous!==false){auth.current=null;host.current.setSession(null);wallet.current?.setSession(null);setInfo('No se pudo iniciar sesión. Utiliza una cuenta autorizada del laboratorio.');void client.auth.signOut({scope:'local'}).catch(()=>{});return;}
   fence.current?.arm();host.current.setSession(token);wallet.current.setSession(token);
   if(revision.current!==request)return;
   setSigned(true);setInfo('Sesión de laboratorio iniciada. Introduce el identificador de tu remesa de prueba.');
  }catch(error){if(mounted.current&&revision.current===request){fence.current?.disarm();auth.current=null;host.current?.setSession(null);wallet.current?.setSession(null);setInfo(error?.message==='AUTH_DEADLINE'?'El laboratorio no respondió a tiempo. Intenta nuevamente.':'No se pudo conectar al laboratorio.');if(client&&error?.message!=='AUTH_DEADLINE')void client.auth.signOut({scope:'local'}).catch(()=>{});}}
  finally{if(mounted.current&&revision.current===request){pending.current=false;setBusy(false);}}
 }
 async function logout(){
  const request=++revision.current,old=auth.current;fence.current?.disarm();auth.current=null;pending.current=false;
  host.current?.setSession(null);wallet.current?.setSession(null);setSigned(false);setBusy(false);setOrder('');setPassword('');setInfo('Sesión local cerrada.');
  if(old){try{const {error}=await authDeadline(()=>old.auth.signOut({scope:'local'}));if(error&&mounted.current&&revision.current===request)setInfo('Sesión local cerrada. No se pudo confirmar la revocación remota.');}catch{if(mounted.current&&revision.current===request)setInfo('Sesión local cerrada. No se pudo confirmar la revocación remota.');}}
 }
 // Explicit diagnostic: prove a previously working bearer cannot read the same
 // synthetic order after remote logout. Never display, persist or log the token.
 async function verifyRevocation(){
  const ownOrder=order.trim(),old=auth.current;
  if(pending.current||!signed||!old||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(ownOrder))return;
  const request=++revision.current;pending.current=true;setBusy(true);setInfo('Verificando acceso y revocación…');
  let token=null,reader=null,walletReader=null,positive=false,walletPositive=false,revoked=false,walletRevoked=false;
  const current=()=>mounted.current&&revision.current===request;
  try{
   const {data,error}=await authDeadline(()=>old.auth.getSession());
   if(!error&&typeof data?.session?.access_token==='string'){
    token=data.session.access_token;
    reader=createOrderStatusClient({environment:'sandbox',sandboxOrigin:origin,transport:'hosted-rpc',publishableKey,fetchImpl:expoFetch});
    const own=await reader.read({sessionToken:token,orderId:ownOrder});
    positive=own.ok===true;
    walletReader=createPortfolioClient({environment:'sandbox',sandboxOrigin:origin,transport:'hosted-snapshot',publishableKey,fetchImpl:expoFetch});
    const ownWallet=await walletReader.read(token);walletPositive=ownWallet.ok===true;
   }
  }catch{}
  if(!current())return;
  fence.current?.disarm();auth.current=null;host.current?.setSession(null);wallet.current?.setSession(null);setSigned(false);setOrder('');setPassword('');
  try{
   const {error}=await authDeadline(()=>old.auth.signOut({scope:'local'}));
   if(!error&&positive&&walletPositive&&current()){
    const denied=await reader.read({sessionToken:token,orderId:ownOrder});
    revoked=denied.ok===false&&['NOT_FOUND','AUTH_REQUIRED'].includes(denied.code);
    const deniedWallet=await walletReader.read(token);walletRevoked=deniedWallet.ok===false&&deniedWallet.code==='AUTH_REQUIRED';
   }
  }catch{}
  finally{
   token=null;
   if(current()){
    pending.current=false;setBusy(false);
    setInfo(revoked&&walletRevoked?'APROBADO: el token anterior ya no permite consultar la remesa ni la billetera. Sesión cerrada.':positive&&walletPositive?'Sesión local cerrada. Revocación de ambas consultas no comprobada.':'Sesión local cerrada. No se comprobó acceso propio previo a remesa y billetera; prueba inconclusa.');
   }
  }
 }
 const button=(label,action,disabled=false)=><TouchableOpacity accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} style={[styles.button,disabled&&styles.disabled]} onPress={action}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
 return <SafeAreaView style={styles.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
  <Text accessibilityRole="header" style={styles.title}>Moneda Mundial | LAB Financiero</Text>
  <Text style={styles.warning}>SOLO PRUEBAS · SIN DINERO REAL</Text>
  <Text style={styles.text}>Entorno independiente. Esta versión solo consulta remesas y capturas contables de laboratorio. No permite depósitos, transferencias ni pagos.</Text>
  {!signed?<View>
   <Text style={styles.text}>Correo de la cuenta de laboratorio</Text><TextInput accessibilityLabel="Correo" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" editable={!busy} style={styles.input} value={email} onChangeText={setEmail}/>
   <Text style={styles.text}>Contraseña de laboratorio</Text><TextInput accessibilityLabel="Contraseña" secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} style={styles.input} value={password} onChangeText={setPassword}/>
   {button(busy?'Iniciando sesión…':'Iniciar sesión',login,busy||!email.trim()||!password)}
  </View>:<View>
   <Text style={styles.text}>Identificador de la remesa de prueba</Text>
   <TextInput accessibilityLabel="Identificador de remesa" autoCapitalize="none" autoCorrect={false} style={styles.input} value={order} onChangeText={v=>{setOrder(v);host.current?.selectOrder(v.trim());}}/>
   <Panel {...state} onRefresh={(id,rev)=>{void host.current?.refresh(id,rev);}}/>
   {wallet.current?.render('es')}
   {button('Cerrar sesión',logout,busy)}
   {button('Verificar revocación y cerrar sesión',verifyRevocation,busy||!order.trim())}
  </View>}
  {!!info&&<Text accessibilityLiveRegion="polite" style={styles.text}>{info}</Text>}
 </ScrollView></SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><Lab/></SafeAreaProvider>;}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#09182a'},content:{padding:20,gap:12},title:{fontSize:24,fontWeight:'700',color:'#fff'},warning:{fontSize:14,fontWeight:'700',color:'#f4cc81'},text:{fontSize:15,color:'#d4e0f1',marginBottom:8},input:{color:'#fff',backgroundColor:'#13253e',padding:13,borderRadius:8,marginBottom:14,borderWidth:1,borderColor:'#36506f'},button:{padding:14,backgroundColor:'#276af1',borderRadius:10,marginVertical:10},buttonText:{color:'#fff',fontWeight:'700',textAlign:'center'},disabled:{opacity:0.5}});
