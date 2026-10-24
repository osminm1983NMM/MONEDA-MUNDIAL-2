// Completely offline read-only preview for Android users without an account.
import React,{useState} from 'react';
import GuestCryptoPreviewScreen from './GuestCryptoPreviewScreen';
import GuestReadinessPreviewScreen from './GuestReadinessPreviewScreen';
import GuestCashPickupPreviewScreen from './GuestCashPickupPreviewScreen';
import GuestWorldCountriesScreen from './GuestWorldCountriesScreen';
import GuestHistoryPreviewScreen from './GuestHistoryPreviewScreen';
import {View,Text,TouchableOpacity} from 'react-native';
import {DEMO_PREVIEW_REAL_PAYMENTS_ENABLED,getPublicDemoTour} from './src/demo-tour.mjs';
// Identidad visual DEMO: azul nocturno, azul eléctrico y violeta.
// Solo cambia la presentación; todas las acciones siguen siendo de lectura.
const s={
 box:{backgroundColor:'#070D21',borderColor:'#263B73',borderWidth:1,borderRadius:22,padding:16,marginVertical:8},
 hero:{flexDirection:'row',alignItems:'center',marginBottom:16},
 monogram:{width:64,height:64,borderRadius:22,backgroundColor:'#1B2252',borderWidth:2,borderColor:'#28D6FA',alignItems:'center',justifyContent:'center',marginRight:14},
 monogramText:{color:'#FFFFFF',fontSize:31,fontWeight:'900'},
 heroCopy:{flex:1,minWidth:0},
 eyebrow:{color:'#28D6FA',fontSize:11,fontWeight:'800',letterSpacing:1.4,marginBottom:5},
 title:{color:'#FFFFFF',fontSize:23,fontWeight:'800',lineHeight:29},
 tagline:{color:'#BAAAFF',fontSize:13,fontWeight:'700',marginTop:5},
 warningCard:{backgroundColor:'#27213F',borderColor:'#7560BE',borderWidth:1,borderRadius:13,padding:13,marginBottom:17},
 banner:{color:'#F8DFA7',fontSize:13,fontWeight:'800',textAlign:'center'},
 text:{color:'#BCCBE8',fontSize:14,lineHeight:22,marginBottom:7},
 sectionHeading:{color:'#8BDFFC',fontSize:12,fontWeight:'800',letterSpacing:1.2,marginTop:16,marginBottom:10},
 card:{borderRadius:16,backgroundColor:'#111D3B',borderColor:'#2B3F73',borderWidth:1,padding:14,marginVertical:5,flexDirection:'row',alignItems:'flex-start'},
 cardAccent:{width:4,minHeight:42,backgroundColor:'#9868FF',borderRadius:3,marginRight:13},
 cardBody:{flex:1,minWidth:0},
 sub:{color:'#FFFFFF',fontSize:16,fontWeight:'700',marginBottom:5},
 button:{backgroundColor:'#172B56',borderColor:'#38538F',borderWidth:1,borderRadius:14,paddingVertical:16,paddingHorizontal:14,marginTop:11,minHeight:53},
 buttonPrimary:{backgroundColor:'#2459B4',borderColor:'#4E9BFF'},
 buttonHistory:{backgroundColor:'#382B77',borderColor:'#9868FF'},
 buttonText:{color:'#FFFFFF',textAlign:'center',fontWeight:'700',fontSize:14,lineHeight:20}
};
export default function DemoTourScreen({language='es',onClose}){
 const [viewCrypto,setViewCrypto]=useState(false);
 const [viewReadiness,setViewReadiness]=useState(false);
 const [viewCashPickup,setViewCashPickup]=useState(false);
 const [viewWorldCountries,setViewWorldCountries]=useState(false);
 const [viewHistory,setViewHistory]=useState(false);
 const content=getPublicDemoTour(language);
 if(DEMO_PREVIEW_REAL_PAYMENTS_ENABLED) throw Error('Offline demo preview must not enable real payments');
 if(viewWorldCountries)return <GuestWorldCountriesScreen language={language} onBack={()=>setViewWorldCountries(false)}/>;
 if(viewHistory)return <GuestHistoryPreviewScreen language={language} onBack={()=>setViewHistory(false)}/>;
 if(viewCashPickup)return <GuestCashPickupPreviewScreen language={language} onBack={()=>setViewCashPickup(false)}/>;
 if(viewCrypto)return <GuestCryptoPreviewScreen language={language} onBack={()=>setViewCrypto(false)}/>;
 if(viewReadiness)return <View style={s.box}><GuestReadinessPreviewScreen/><TouchableOpacity accessibilityRole="button" style={s.button} onPress={()=>setViewReadiness(false)}><Text style={s.buttonText}>Volver al recorrido de Moneda Mundial</Text></TouchableOpacity></View>;
 return <View style={s.box}>
  <View style={s.hero}>
   <View style={s.monogram}><Text style={s.monogramText}>M</Text></View>
   <View style={s.heroCopy}>
    <Text style={s.eyebrow}>MONEDA MUNDIAL 2.0</Text>
    <Text style={s.title}>{content.heading}</Text>
    <Text style={s.tagline}>Un valor. Un mundo.</Text>
   </View>
  </View>
  <View style={s.warningCard}><Text style={s.banner}>{content.warning}</Text></View>
  <Text style={s.text}>{content.subtitle}</Text>
  <Text style={s.sectionHeading}>{language==='en'?'GLOBAL VISION':'VISIÓN GLOBAL'}</Text>
  {content.sections.map(item=><View key={item.id} style={s.card} accessible accessibilityLabel={item.title+'. '+item.detail}>
   <View style={s.cardAccent}/><View style={s.cardBody}>
    <Text style={s.sub}>{item.title}</Text>
    <Text style={s.text}>{item.detail}</Text>
   </View>
  </View>)}
  <Text style={s.sectionHeading}>{language==='en'?'EXPLORE THE DEMO':'EXPLORAR DEMOSTRACIÓN'}</Text>
  <TouchableOpacity accessibilityRole="button" style={[s.button,s.buttonPrimary]}
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
  <TouchableOpacity accessibilityRole="button" style={[s.button,s.buttonHistory]}
    accessibilityLabel={language==='en'?'History preview with invented data':'Vista previa del Historial con datos inventados'}
    onPress={()=>setViewHistory(true)}>
    <Text style={s.buttonText}>{language==='en'?'History preview (invented data)':'Vista previa del Historial (datos inventados)'}</Text>
  </TouchableOpacity>
  <Text style={s.text}>{content.footer}</Text>
  <TouchableOpacity accessibilityRole="button" style={s.button} onPress={onClose}
    accessibilityLabel={content.back}><Text style={s.buttonText}>{content.back}</Text></TouchableOpacity>
 </View>;
}
