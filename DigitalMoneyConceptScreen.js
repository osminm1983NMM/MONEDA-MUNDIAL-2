import React,{useState} from 'react';
import {View,Text,TextInput} from 'react-native';
import {compareInternationalPriceDemo} from './src/digital-money/design-and-comparison.mjs';
const s={panel:{backgroundColor:'#152b42',borderRadius:12,padding:14,marginVertical:9},text:{color:'#e1edf4',marginVertical:6},warning:{color:'#f3c887',marginVertical:8},input:{color:'#fff',backgroundColor:'#28465c',borderRadius:7,padding:11,marginVertical:7}};
export default function DigitalMoneyConceptScreen(){
 const [currency,setCurrency]=useState('PEN'),[price,setPrice]=useState(''),[rate,setRate]=useState(''),[seller,setSeller]=useState(''),[hypothesis,setHypothesis]=useState('');
 const q=compareInternationalPriceDemo({localCurrency:currency,localPrice:price,localUnitsPerUsd:rate,sellerUsd:seller,tokenUsdExample:hypothesis});
 return <View style={s.panel}>
  <Text style={s.text}>MONEDA MUNDIAL DIGITAL · OPCIÓN C</Text>
  <Text style={s.text}>MWD actuales: créditos de prueba sin valor financiero. NO son criptomonedas.</Text>
  <Text style={s.text}>Pago estable: propuesta futura con emisor autorizado. Paridad no operativa.</Text>
  <Text style={s.text}>Moneda Mundial Coin: propuesta de criptomoneda de precio variable. Sin emisión, oferta total, cotización ni blockchain elegidos.</Text>
  <Text style={s.warning}>NO SE PUEDE COMPRAR, VENDER, EMITIR NI TRANSFERIR CRIPTOMONEDAS AQUÍ.</Text>
  <Text style={s.text}>Comparador educativo de productos · valores manuales no verificados</Text>
  <Text style={s.text}>Moneda local ISO (PEN, HNL, NIO...)</Text>
  <TextInput style={s.input} value={currency} maxLength={3} autoCapitalize="characters" onChangeText={v=>setCurrency(v.toUpperCase())} placeholder="PEN" placeholderTextColor="#aec5cf"/>
  <Text style={s.text}>Precio del producto en moneda local</Text>
  <TextInput style={s.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Ejemplo: 10" placeholderTextColor="#aec5cf"/>
  <Text style={s.text}>Tipo de cambio MANUAL: unidades locales por dólar</Text>
  <TextInput style={s.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="No es una tasa oficial" placeholderTextColor="#aec5cf"/>
  <Text style={s.text}>Precio en USD indicado por el vendedor</Text>
  <TextInput style={s.input} value={seller} onChangeText={setSeller} keyboardType="decimal-pad" placeholder="Ejemplo: 3" placeholderTextColor="#aec5cf"/>
  <Text style={s.text}>Valor hipotético de Coin en USD (opcional; NO precio real)</Text>
  <TextInput style={s.input} value={hypothesis} onChangeText={setHypothesis} keyboardType="decimal-pad" placeholder="Sin cotización" placeholderTextColor="#aec5cf"/>
  {q?<View style={s.panel}>
    <Text style={s.text}>Equivalencia ilustrativa: {(q.referenceUsdCents/100).toFixed(2)} USD</Text>
    <Text style={s.text}>Precio informado: {(q.sellerUsdCents/100).toFixed(2)} USD</Text>
    <Text style={s.text}>Diferencia: {(q.differenceUsdCents/100).toFixed(2)} USD</Text>
    {q.hypotheticalCoinUnits!==null&&<Text style={s.text}>Unidades de moneda imaginaria a ese precio: {q.hypotheticalCoinUnits}</Text>}
  </View>:<Text style={s.text}>Introduce los importes válidos para comparar.</Text>}
  <Text style={s.warning}>La conversión no garantiza ahorro ni determina el precio del producto. No incluye comisiones, impuestos ni tipo de cambio verificado. Requiere aceptación del vendedor.</Text>
 </View>;
}
