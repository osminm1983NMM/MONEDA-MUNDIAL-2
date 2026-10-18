// Completely offline read-only preview for Android users without an account.
import React,{useState} from 'react';
import GuestCryptoPreviewScreen from './GuestCryptoPreviewScreen';
import GuestReadinessPreviewScreen from './GuestReadinessPreviewScreen';
import GuestCashPickupPreviewScreen from './GuestCashPickupPreviewScreen';
import GuestWorldCountriesScreen from './GuestWorldCountriesScreen';
import {View,Text,TouchableOpacity} from 'react-native';
import {DEMO_PREVIEW_REAL_PAYMENTS_ENABLED,getPublicDemoTour} from './src/demo-tour.mjs';
const s={
 box:{backgroundColor:'#162b45',borderRadius:14,padding:16,marginVertical:8},
 title:{color:'#fff',fontSize:22,fontWeight:'bold',marginBottom:9},
 text:{color:'#d7e6f5',fontSize:14,lineHeight:21,marginBottom:6},
 banner:{color:'#ffda91',fontSize:14,fontWeight:'bold',marginVertical:8},
 card:{borderRadius:10,backgroundColor:'#223d5c',padding:12,marginVertical:5},
 sub:{color:'#fff',fontSize:16,fontWeight:'600',marginBottom:4},
 button:{backgroundColor:'#2b72ba',borderRadius:9,padding:13,marginTop:14},
 buttonText:{color:'#fff',textAlign:'center',fontWeight:'600'}
};
export default function DemoTourScreen({language='es',onClose}){
 const [viewCrypto,setViewCrypto]=useState(false);
 const [viewReadiness,setViewReadiness]=useState(false);
 const [viewCashPickup,setViewCashPickup]=useState(false);
 const [viewWorldCountries,setViewWorldCountries]=useState(false);
 const content=getPublicDemoTour(language);
 if(DEMO_PREVIEW_REAL_PAYMENTS_ENABLED) throw Error('Offline demo preview must not enable real payments');
 if(viewWorldCountries)return <GuestWorldCountriesScreen language={language} onBack={()=>setViewWorldCountries(false)}/>;
 if(viewCashPickup)return <GuestCashPickupPreviewScreen language={language} onBack={()=>setViewCashPickup(false)}/>;
 if(viewCrypto)return <GuestCryptoPreviewScreen language={language} onBack={()=>setViewCrypto(false)}/>;
 if(viewReadiness)return <View style={s.box}><GuestReadinessPreviewScreen/><TouchableOpacity accessibilityRole="button" style={s.button} onPress={()=>setViewReadiness(false)}><Text style={s.buttonText}>Volver al recorrido de Moneda Mundial</Text></TouchableOpacity></View>;
 return <View style={s.box}>
  <Text style={s.title}>{content.heading}</Text>
  <Text style={s.banner}>{content.warning}</Text>
  <Text style={s.text}>{content.subtitle}</Text>
  {content.sections.map(item=><View key={item.id} style={s.card} accessible accessibilityLabel={item.title+'. '+item.detail}>
   <Text style={s.sub}>{item.title}</Text>
   <Text style={s.text}>{item.detail}</Text>
  </View>)}
  <TouchableOpacity accessibilityRole="button" style={s.button}
    accessibilityLabel={language==='en'?'Explore Coin and Digital details':'Conocer Coin y Digital'}
    onPress={()=>setViewCrypto(true)}>
    <Text style={s.buttonText}>{language==='en'?'Explore Coin and Digital (research)':'Conocer Coin y Digital (investigación)'}</Text>
  </TouchableOpacity>
  <TouchableOpacity accessibilityRole="button" style={s.button} onPress={()=>setViewReadiness(true)}><Text style={s.buttonText}>Ver requisitos pendientes (sin cuenta)</Text></TouchableOpacity>
  <TouchableOpacity accessibilityRole="button" style={s.button} accessibilityLabel={language==='en'?'Explore cash pickup without a phone':'Conocer retiro sin teléfono'} onPress={()=>setViewCashPickup(true)}><Text style={s.buttonText}>{language==='en'?'Explore cash pickup without a phone (demo)':'Conocer retiro sin teléfono (demostración)'}</Text></TouchableOpacity>
  <TouchableOpacity accessibilityRole="button" style={s.button}
    accessibilityLabel={language==='en'?'Explore countries worldwide':'Explorar países del mundo'}
    onPress={()=>setViewWorldCountries(true)}>
    <Text style={s.buttonText}>{language==='en'?'Explore all countries (research only)':'Explorar países del mundo (solo investigación)'}</Text>
  </TouchableOpacity>
  <Text style={s.text}>{content.footer}</Text>
  <TouchableOpacity accessibilityRole="button" style={s.button} onPress={onClose}
    accessibilityLabel={content.back}><Text style={s.buttonText}>{content.back}</Text></TouchableOpacity>
 </View>;
}
