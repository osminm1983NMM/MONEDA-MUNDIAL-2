// Pantalla pública de lectura; no utiliza cuenta ni consulta proveedores.
import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {GUEST_CASH_PICKUP_REAL_PAYMENTS_ENABLED,getGuestCashPickupPreview} from './src/guest-cash-pickup-preview.mjs';
const s={box:{backgroundColor:'#162b45',borderRadius:14,padding:16,marginVertical:8},heading:{color:'#fff',fontSize:21,fontWeight:'bold'},warn:{color:'#ffda91',marginVertical:9,fontWeight:'bold'},text:{color:'#d7e6f5',marginVertical:6,lineHeight:21},card:{backgroundColor:'#223d5c',borderRadius:10,padding:12,marginTop:9},button:{backgroundColor:'#2b72ba',padding:13,borderRadius:9,marginTop:12},buttonText:{color:'#fff',fontWeight:'600',textAlign:'center'}};
export default function GuestCashPickupPreviewScreen({language='es',onBack}){
 const [destination,setDestination]=useState('HN');
 if(GUEST_CASH_PICKUP_REAL_PAYMENTS_ENABLED)throw Error('No permitir pagos reales en pantalla pública');
 const data=getGuestCashPickupPreview({language,destination});
 return <View style={s.box}>
  <Text style={s.heading}>{data.heading}</Text>
  <Text style={s.warn}>{data.warning}</Text>
  <Text style={s.text}>{data.subtitle}</Text>
  <Text style={s.text}>{data.choose}</Text>
  <View style={{flexDirection:'row',gap:8}}>
   {['HN','NI'].map(code=><TouchableOpacity key={code} accessibilityRole="button"
    accessibilityLabel={code==='HN'?'Honduras':'Nicaragua'}
    onPress={()=>setDestination(code)}
    style={[s.button,{flex:1,backgroundColor:destination===code?'#387bca':'#34506b'}]}>
    <Text style={s.buttonText}>{code==='HN'?'Honduras':'Nicaragua'}</Text>
   </TouchableOpacity>)}
  </View>
  <Text style={s.text}>{data.coverage}</Text>
  <Text style={s.warn}>{data.routeLabel}</Text>
  <Text style={s.warn}>{data.reference}</Text>
  <Text style={s.text}>{data.status}</Text>
  {data.steps.map(step=><View key={step.id} style={s.card}>
   <Text style={[s.text,{fontWeight:'bold'}]}>{step.title}</Text>
   <Text style={s.text}>{step.detail}</Text>
  </View>)}
  <Text style={s.warn}>{data.blocked}</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={data.back}
   onPress={onBack} style={s.button}><Text style={s.buttonText}>{data.back}</Text></TouchableOpacity>
 </View>;
}
