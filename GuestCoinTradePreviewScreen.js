import React,{useState} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {getGuestCoinTradePreview,GUEST_COIN_TRADE_REAL_FUNDS_ENABLED} from './src/guest-coin-trade-preview.mjs';
const st={
 box:{backgroundColor:'#142d48',padding:15,borderRadius:12,marginVertical:8},
 text:{color:'#d8e7f6',marginVertical:6},warn:{color:'#ffda91',fontWeight:'bold',marginVertical:8},
 heading:{color:'white',fontSize:21,fontWeight:'bold',marginVertical:6},
 button:{backgroundColor:'#31587a',borderRadius:8,padding:12,marginVertical:5},
 input:{backgroundColor:'#284d68',color:'white',borderRadius:8,padding:10,marginVertical:6},
};
export default function GuestCoinTradePreviewScreen({language='es',onBack}){
 const [side,setSide]=useState('buy'),[coinUnits,setCoinUnits]=useState('10');
 const [coinUsdScenario,setCoinUsdScenario]=useState('0.25'),[feeBps,setFeeBps]=useState('100');
 if(GUEST_COIN_TRADE_REAL_FUNDS_ENABLED)throw Error('No se permiten fondos reales');
 const v=getGuestCoinTradePreview({language,side,coinUnits,coinUsdScenario,feeBps});
 const labels=getGuestCoinTradePreview({language,side:'buy'});
 return <View style={st.box}>
  <Text style={st.heading}>{labels.heading}</Text>
  <Text style={st.warn}>{labels.warning}</Text>
  <Text style={st.text}>{labels.intro}</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.buy} style={st.button} onPress={()=>setSide('buy')}>
   <Text style={st.text}>{side==='buy'?'✓ ':''}{labels.buy}</Text>
  </TouchableOpacity>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.sell} style={st.button} onPress={()=>setSide('sell')}>
   <Text style={st.text}>{side==='sell'?'✓ ':''}{labels.sell}</Text>
  </TouchableOpacity>
  <Text style={st.text}>{labels.units}</Text>
  <TextInput style={st.input} keyboardType="decimal-pad" accessibilityLabel={labels.units}
   value={coinUnits} onChangeText={setCoinUnits}/>
  <Text style={st.text}>{labels.unitPrice}</Text>
  <TextInput style={st.input} keyboardType="decimal-pad" accessibilityLabel={labels.unitPrice}
   value={coinUsdScenario} onChangeText={setCoinUsdScenario}/>
  <Text style={st.text}>{labels.fee}</Text>
  <TextInput style={st.input} keyboardType="number-pad" accessibilityLabel={labels.fee}
   value={feeBps} onChangeText={setFeeBps}/>
  {!v?.quote?<Text style={st.warn}>{labels.ready}</Text>:<View>
   <Text style={st.text}>{labels.gross}: {v.quote.grossUsd}</Text>
   <Text style={st.text}>{labels.feeResult}: {v.quote.illustrativeFeeUsd}</Text>
   <Text style={st.text}>{side==='buy'?labels.buyTotal:labels.sellNet}: {side==='buy'?
    v.quote.hypotheticalBuyerTotalUsd:v.quote.hypotheticalSellerProceedsUsd}</Text>
  </View>}
  <Text style={st.warn}>{labels.caveat}</Text>
  <Text style={st.warn}>{labels.blocked}</Text>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.back}
   onPress={onBack} style={st.button}><Text style={st.text}>{labels.back}</Text></TouchableOpacity>
 </View>;
}
