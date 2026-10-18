// Offline, unauthenticated list of research destinations. Never contacts a bank.
import React,{useState} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';
import {getGuestWorldCountryPreview,GUEST_WORLD_COUNTRIES_REAL_PAYMENTS_ENABLED}
 from './src/guest-world-countries-preview.mjs';
const s={
 panel:{backgroundColor:'#172f49',padding:16,borderRadius:14,marginVertical:8},
 title:{color:'white',fontSize:21,fontWeight:'bold',marginBottom:10},
 text:{color:'#dceaf5',marginVertical:6,lineHeight:20},
 warn:{color:'#ffdf9c',fontWeight:'bold',marginVertical:8},
 input:{backgroundColor:'#284d69',color:'white',padding:12,borderRadius:9,marginVertical:8},
 country:{backgroundColor:'#244464',borderRadius:9,padding:12,marginVertical:4},
 back:{backgroundColor:'#2b72ba',padding:13,borderRadius:10,marginTop:15},
};
export default function GuestWorldCountriesScreen({language='es',onBack}){
 const [query,setQuery]=useState('');
 if(GUEST_WORLD_COUNTRIES_REAL_PAYMENTS_ENABLED)throw Error('No public real-money routes');
 const v=getGuestWorldCountryPreview({language,query});
 return <View style={s.panel}>
  <Text style={s.title}>{v.title}</Text>
  <Text style={s.warn}>{v.warning}</Text>
  <Text style={s.text}>{v.subtitle}</Text>
  <Text style={s.text}>{v.listed}: {v.totalCount}</Text>
  <TextInput style={s.input} accessibilityLabel={v.placeholder}
   placeholder={v.placeholder} placeholderTextColor="#c3d5e5"
   value={query} onChangeText={setQuery} maxLength={80} autoCorrect={false}/>
  <Text style={s.text}>{v.shown}: {v.visibleCount}</Text>
  {v.results.length===0?<Text style={s.warn}>{v.empty}</Text>:
   v.results.map(country=><View key={country.code} style={s.country}>
    <Text style={s.text}>{country.name} ({country.code})</Text>
    <Text style={s.warn}>{v.unavailable}</Text>
   </View>)}
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={v.back}
   style={s.back} onPress={onBack}>
   <Text style={{textAlign:'center',color:'white',fontWeight:'bold'}}>{v.back}</Text>
  </TouchableOpacity>
 </View>;
}
