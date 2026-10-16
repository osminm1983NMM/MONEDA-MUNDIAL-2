import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {runAdminReadOnlyChecks} from './src/admin-diagnostics.mjs';
// Solo lectura. La verificación no realiza registros ni transacciones.
export default function AdminDiagnosticsPanel({supabase}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function check(){
  if(busy)return;
  setBusy(true);setRows([]);setError('');
  try{
   const data=await runAdminReadOnlyChecks((name,args)=>supabase.rpc(name,args));
   setRows(data);
  }catch{setError('No se pudo realizar el diagnóstico.');}
  finally{setBusy(false);}
 }
 return <View style={{backgroundColor:'#183349',borderRadius:12,padding:14,marginBottom:16}}>
  <Text style={{color:'white',fontSize:18,fontWeight:'800'}}>Diagnóstico administrativo</Text>
  <Text style={{color:'#f8d9a0',lineHeight:20,marginVertical:9}}>Solo consulta el estado de los módulos; no crea bancos, no mueve dinero ni verifica autorizaciones regulatorias.</Text>
  <TouchableOpacity accessibilityRole="button" onPress={check} disabled={busy}
    style={{backgroundColor:'#187b76',padding:13,borderRadius:9}}>
   <Text style={{color:'white',textAlign:'center'}}>{busy?'Comprobando...':'Comprobar módulos disponibles'}</Text>
  </TouchableOpacity>
  {!!error&&<Text style={{color:'#ffb2b2',marginTop:8}}>{error}</Text>}
  {rows.map(row=><Text key={row.id} style={{color:row.status==='disponible'?'#b1f3ce':'#ffe0ad',marginTop:9}}>
   {row.name}: {row.status}{row.count!==null?' · '+row.count+' registros':''}
  </Text>)}
  <Text style={{color:'#f8d9a0',marginTop:9}}>Retiros y pagos reales habilitados: 0.</Text>
 </View>;
}
