// Read-only, completely offline product introduction for unauthenticated users.
import React,{useState} from 'react';
import GuestCoinTradePreviewScreen from './GuestCoinTradePreviewScreen';
import {View,Text,TouchableOpacity} from 'react-native';
import {GUEST_CRYPTO_REAL_FUNDS_ENABLED,getGuestCryptoResearchPreview}
 from './src/guest-crypto-preview.mjs';

const s={
 box:{backgroundColor:'#142d48',borderRadius:14,padding:16,marginVertical:8},
 heading:{color:'#fff',fontSize:22,fontWeight:'bold',marginBottom:12},
 text:{color:'#d8e7f6',fontSize:15,lineHeight:21,marginVertical:7},
 warning:{color:'#ffdb91',fontWeight:'700',marginVertical:8},
 card:{backgroundColor:'#223e5e',padding:14,borderRadius:12,marginVertical:8},
 title:{color:'#fff',fontSize:19,fontWeight:'700',marginBottom:5},
 button:{backgroundColor:'#2b72ba',borderRadius:9,padding:13,marginTop:16},
 buttonText:{textAlign:'center',color:'#fff',fontWeight:'700'},
};

export default function GuestCryptoPreviewScreen({language='es',onBack}){
 const [tradeOpen,setTradeOpen]=useState(false);
 if(GUEST_CRYPTO_REAL_FUNDS_ENABLED)throw Error('Vista pública no puede operar fondos');
 if(tradeOpen)return <GuestCoinTradePreviewScreen language={language} onBack={()=>setTradeOpen(false)}/>;
 const view=getGuestCryptoResearchPreview(language);
 return <View style={s.box}>
  <Text style={s.heading}>{view.heading}</Text>
  <Text style={s.warning}>{view.warning}</Text>
  <Text style={s.text}>{view.subtitle}</Text>
  {view.cards.map(card=><View key={card.id} style={s.card}>
   <Text style={s.title}>{card.title}</Text>
   <Text style={s.warning}>{card.status}</Text>
   <Text style={s.text}>{card.description}</Text>
  </View>)}
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={language==='en'?'Explore hypothetical Coin buying and selling':'Simular compra y venta de Coin'}
   style={s.button} onPress={()=>setTradeOpen(true)}><Text style={s.buttonText}>{language==='en'?'Coin buy / sell (example only)':'Compra y venta de Coin (solo ejemplo)'}</Text></TouchableOpacity>
  <Text style={s.warning}>{view.footer}</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={view.returnLabel}
    style={s.button} onPress={onBack}>
   <Text style={s.buttonText}>{view.returnLabel}</Text>
  </TouchableOpacity>
 </View>;
}
