import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {quoteLocalLab,readLocalLab,saveLocalLabConversion,viewLocalLab,LAB_STARTING_UNITS}
  from './src/digital-money/coin-digital-local-lab.mjs';

function Choice({selected,onPress,children}){
 return <TouchableOpacity accessibilityRole="button" accessibilityState={{selected}}
   style={[styles.choice,selected&&styles.chosen]} onPress={onPress}>
   <Text style={styles.choiceText}>{selected?'✓ ':''}{children}</Text>
 </TouchableOpacity>;
}

export default function CoinDigitalLabScreen({userId}){
 const [record,setRecord]=useState(null),[loadError,setLoadError]=useState('');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [direction,setDirection]=useState('coin_to_digital');
 const [amount,setAmount]=useState('10'),[coinUsd,setCoinUsd]=useState('0.25');
 const [digitalUsd,setDigitalUsd]=useState('1');
 const activeUserRef=useRef(userId),busyRef=useRef(false);
 const [retryCount,setRetryCount]=useState(0);
 useEffect(()=>{
  let active=true;
  activeUserRef.current=userId;
  busyRef.current=false;
  setRecord(null);setLoadError('');setLoading(true);setSaving(false);
  readLocalLab(AsyncStorage,userId).then(data=>{
   if(active){setRecord(data);setLoading(false);}
  }).catch(()=>{
   if(active){setLoadError('No se pudo leer el laboratorio. Los datos no se borraron.');setLoading(false);}
  });
  return ()=>{active=false;activeUserRef.current=null;};
 },[userId,retryCount]);

 const quote=quoteLocalLab({direction,amount,coinUsd,digitalUsd});
 const view=record?viewLocalLab(record,userId):null;
 const fromBalance=view?.balances[direction==='coin_to_digital'?'coin':'digital'];

 function confirmConversion(){
  if(!record||!quote||busyRef.current||loading||saving)return;
  const owner=userId;
  const scenario={direction,amount,coinUsd,digitalUsd};
  Alert.alert('Sólo conversión ficticia',
   `Registrar ${quote.fromAmount} ${quote.fromAsset.toUpperCase()} → ${quote.toAmount} ${quote.toAsset.toUpperCase()} en este Samsung? NO cambia MWD ni dinero real.`,
   [{text:'Cancelar',style:'cancel'},
    {text:'Registrar prueba',onPress:async()=>{
      if(busyRef.current||activeUserRef.current!==owner)return;
      busyRef.current=true;setSaving(true);
      try{
       const requestId='lab_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
       const result=await saveLocalLabConversion(AsyncStorage,owner,scenario,requestId);
       if(activeUserRef.current===owner){
        setRecord(result.state);
        Alert.alert('Prueba registrada','Se actualizaron únicamente las fichas locales Coin/Digital.');
       }
      }catch(error){
       if(activeUserRef.current===owner)
        Alert.alert('No se registró la prueba',error?.message||'No se guardaron cambios.');
      }finally{
       busyRef.current=false;
       if(activeUserRef.current===owner)setSaving(false);
      }
    }}]);
 }

 return <View style={styles.card}>
  <Text style={styles.title}>LABORATORIO Coin ↔ Digital</Text>
  <Text style={styles.warning}>FICHAS IMAGINARIAS · SÓLO ESTE SAMSUNG · SIN DINERO REAL</Text>
  <Text style={styles.note}>Este laboratorio NO usa Supabase, no modifica tu saldo MWD ni emite criptomonedas. No se sincroniza con otro teléfono y puede perderse si borras los datos de la app.</Text>
  {loading?<Text style={styles.note}>Cargando fichas locales…</Text>
   :loadError?<View>
    <Text style={styles.warning}>{loadError}</Text>
    <TouchableOpacity style={styles.button} onPress={()=>setRetryCount(v=>v+1)}>
     <Text style={styles.buttonText}>Volver a intentar</Text>
    </TouchableOpacity>
   </View>:<>
    <Text style={styles.section}>Saldos separados de esta cuenta</Text>
    <View style={styles.balances}>
     <View style={styles.balance}><Text style={styles.label}>COIN • prueba</Text><Text style={styles.amount}>{view.balances.coin}</Text></View>
     <View style={styles.balance}><Text style={styles.label}>DIGITAL • prueba</Text><Text style={styles.amount}>{view.balances.digital}</Text></View>
    </View>
    <Text style={styles.note}>Cada cuenta empieza con {LAB_STARTING_UNITS} fichas Coin y {LAB_STARTING_UNITS} Digital, únicamente para ensayar cálculos.</Text>
    <Text style={styles.section}>1. Dirección de la prueba</Text>
    <Choice selected={direction==='coin_to_digital'} onPress={()=>setDirection('coin_to_digital')}>Coin → Digital</Choice>
    <Choice selected={direction==='digital_to_coin'} onPress={()=>setDirection('digital_to_coin')}>Digital → Coin</Choice>
    <Text style={styles.section}>2. Cantidad que quieres convertir</Text>
    <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Cantidad de fichas de prueba"/>
    <Text style={styles.label}>Precio imaginario por Coin en USD</Text>
    <TextInput style={styles.input} value={coinUsd} onChangeText={setCoinUsd} keyboardType="decimal-pad" accessibilityLabel="Precio ficticio Coin"/>
    <Text style={styles.label}>Precio imaginario por Digital en USD</Text>
    <TextInput style={styles.input} value={digitalUsd} onChangeText={setDigitalUsd} keyboardType="decimal-pad" accessibilityLabel="Precio ficticio Digital"/>
    {quote?<View style={styles.preview}>
      <Text style={styles.section}>Vista previa matemática</Text>
      <Text style={styles.result}>{quote.fromAmount} {quote.fromAsset.toUpperCase()} → {quote.toAmount} {quote.toAsset.toUpperCase()}</Text>
      <Text style={styles.note}>Saldo disponible de origen: {fromBalance}. Sin comisión en este ejemplo. Los precios son manuales, no cotizaciones.</Text>
     </View>:<Text style={styles.warning}>Introduce una cantidad y dos precios positivos, hasta 6 decimales.</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={!quote||saving}
      style={[styles.button,(!quote||saving)&&styles.disabled]} onPress={confirmConversion}>
      <Text style={styles.buttonText}>{saving?'Guardando prueba…':'Registrar conversión FICTICIA'}</Text>
    </TouchableOpacity>
    <Text style={styles.warning}>No compra, vende, envía, retira ni convierte monedas reales. Nunca se mezcla con la billetera MWD.</Text>
    <Text style={styles.section}>Historial local de conversiones</Text>
    {view.history.length===0?<Text style={styles.note}>Todavía no hay conversiones registradas en esta cuenta.</Text>
     :view.history.slice(0,15).map(item=><View key={item.id} style={styles.history}>
       <Text style={styles.historyTitle}>{item.fromAmount} {item.fromAsset.toUpperCase()} → {item.toAmount} {item.toAsset.toUpperCase()}</Text>
       <Text style={styles.note}>{new Date(item.at).toLocaleString()} · sólo demostración local</Text>
      </View>)}
  </>}
 </View>;
}

const styles=StyleSheet.create({
 card:{backgroundColor:'#112e40',borderRadius:20,padding:18,marginBottom:16,borderWidth:1,borderColor:'#296175'},
 title:{color:'#fff',fontSize:23,fontWeight:'800',marginBottom:10},
 warning:{color:'#ead29a',fontSize:15,fontWeight:'700',lineHeight:22,marginVertical:12},
 note:{color:'#b3cbd5',fontSize:14,lineHeight:21,marginVertical:7},
 section:{color:'#fff',fontSize:18,fontWeight:'700',marginTop:20,marginBottom:10},
 label:{color:'#c6d7df',fontSize:14,marginBottom:6},
 balances:{flexDirection:'row',gap:10},balance:{flex:1,backgroundColor:'#193e50',borderRadius:12,padding:12},
 amount:{color:'#81e3d1',fontSize:25,fontWeight:'800'},
 choice:{backgroundColor:'#27485d',borderRadius:11,padding:15,marginVertical:4},
 chosen:{backgroundColor:'#1c6875',borderColor:'#74d7c2',borderWidth:1},
 choiceText:{color:'#fff',fontSize:17,fontWeight:'700'},
 input:{backgroundColor:'#224357',borderRadius:11,color:'#fff',fontSize:20,padding:14,marginBottom:13},
 preview:{backgroundColor:'#193c4e',padding:12,borderRadius:12,marginTop:8},
 result:{color:'#80e3ce',fontSize:19,fontWeight:'800'},
 button:{backgroundColor:'#168f88',borderRadius:12,padding:17,marginTop:12},
 disabled:{opacity:0.5},buttonText:{color:'#fff',fontSize:17,fontWeight:'800',textAlign:'center'},
 history:{borderBottomWidth:1,borderBottomColor:'#386075',paddingVertical:12},
 historyTitle:{color:'#fff',fontSize:16,fontWeight:'700'},
});
