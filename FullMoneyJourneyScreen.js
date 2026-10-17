// Vista totalmente educativa: no lee dinero ni hace solicitudes de red.
import React,{useState} from 'react';
import {View,Text,TouchableOpacity,TextInput} from 'react-native';
import {previewFullMoneyJourney} from './src/digital-money/full-journey-demo.mjs';
import {SOURCES,PAYOUTS} from './src/digital-money/wallet-remittance-preview.mjs';
import {DEMO_CORRIDORS} from './src/international-demo.mjs';
import {amountToCents} from './src/demo-money.mjs';
import {previewRemittanceDisclosure} from './src/digital-money/remittance-disclosure-demo.mjs';

const s={panel:{backgroundColor:'#142e45',padding:15,borderRadius:12,marginVertical:9},
 text:{color:'#e2eff7',marginVertical:6},warn:{color:'#ffe0a0',marginVertical:7},
 button:{backgroundColor:'#284d68',borderRadius:8,padding:10,marginVertical:4},
 input:{backgroundColor:'#284d68',padding:10,color:'white',borderRadius:7,marginVertical:6}};
export default function FullMoneyJourneyScreen(){
 const [source,setSource]=useState('coin_concept');
 const [payout,setPayout]=useState('cash_pickup');
 const [destination,setDestination]=useState('HN');
 const [amount,setAmount]=useState('100');
 const [coinUnits,setCoinUnits]=useState('10');
 const [coinPrice,setCoinPrice]=useState('0.25');
 const [digitalPrice,setDigitalPrice]=useState('1');
 const [rate,setRate]=useState('');
 const v=previewFullMoneyJourney({source,payout,destination,
  hypotheticalUsdCents:amountToCents(amount),coinUnits,coinUsdScenario:coinPrice,
  digitalUsdScenario:digitalPrice,manualLocalPerUsd:rate});
 const disclosure=previewRemittanceDisclosure({source,payout,destination,hypotheticalUsdCents:amountToCents(amount),manualLocalPerUsd:rate});
 return <View style={s.panel}>
  <Text style={{color:'white',fontSize:21,fontWeight:'800'}}>Recorrido Moneda Mundial</Text>
  <Text style={s.warn}>SOLO DEMOSTRACIÓN EDUCATIVA. No se conecta a bancos, mercados ni billeteras reales. Ningún botón envía fondos.</Text>
  <Text style={s.text}>1. Elegir concepto de origen</Text>
  {SOURCES.map(item=><TouchableOpacity key={item.id} accessibilityRole="button" style={s.button} onPress={()=>setSource(item.id)}>
   <Text style={s.text}>{source===item.id?'✓ ':''}{item.label}</Text>
  </TouchableOpacity>)}
  {source==='coin_concept'&&<View>
   <Text style={s.text}>Coin hipotéticas, precio Coin USD y precio Digital USD (datos manuales)</Text>
   <TextInput style={s.input} value={coinUnits} onChangeText={setCoinUnits} keyboardType="decimal-pad" accessibilityLabel="Coin de ejemplo"/>
   <TextInput style={s.input} value={coinPrice} onChangeText={setCoinPrice} keyboardType="decimal-pad" accessibilityLabel="Precio hipotético Coin"/>
   <TextInput style={s.input} value={digitalPrice} onChangeText={setDigitalPrice} keyboardType="decimal-pad" accessibilityLabel="Precio hipotético Digital"/>
  </View>}
  <Text style={s.text}>2. País destino de ejemplo</Text>
  {DEMO_CORRIDORS.filter(x=>['HN','NI','EC','CR'].includes(x.code)).map(x=>
   <TouchableOpacity key={x.code} accessibilityRole="button" style={s.button} onPress={()=>setDestination(x.code)}>
    <Text style={s.text}>{destination===x.code?'✓ ':''}{x.country}</Text>
   </TouchableOpacity>)}
  <Text style={s.text}>3. Entrega futura</Text>
  {PAYOUTS.map(p=><TouchableOpacity key={p.id} style={s.button} accessibilityRole="button" onPress={()=>setPayout(p.id)}>
   <Text style={s.text}>{payout===p.id?'✓ ':''}{p.label}</Text>
  </TouchableOpacity>)}
  {source==='external_usd_scenario'&&<View>
   <Text style={s.text}>USD hipotéticos, no vinculados a ninguna billetera</Text>
   <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" accessibilityLabel="Importe USD de ejemplo"/>
   <Text style={s.text}>Tasa manual en moneda local por USD. NO es tasa oficial.</Text>
   <TextInput style={s.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" accessibilityLabel="Tasa de cambio ficticia"/>
  </View>}
  {!v?<Text style={s.warn}>Verifica los importes del ejemplo.</Text>:<View>
   {v.steps.map(step=><Text key={step.id} style={s.text}>{step.title}: {step.status==='not_available'?'NO disponible':'solo diseño'}</Text>)}
   <Text style={s.warn}>{v.blockReason}</Text>
   {v.conversionExample&&<Text style={s.text}>Coin→Digital hipotéticas: {v.conversionExample.inputCoinUnits} Coin equivaldrían a {v.conversionExample.hypotheticalDigitalUnits} Digital imaginarias. No se han convertido.</Text>}
   {v.independentUsdExample&&<Text style={s.text}>USD ejemplo: {(v.independentUsdExample.amountCents/100).toFixed(2)} · comisión hipotética {(v.independentUsdExample.feeCents/100).toFixed(2)}.</Text>}
   {v.localCurrencyExample&&<Text style={s.text}>Cantidad ilustrativa: {v.localCurrencyExample.amount} {v.localCurrencyExample.currency}; NO garantizada.</Text>}
  </View>}
  {disclosure&&source==='external_usd_scenario'&&<View style={s.button}>
   <Text style={s.text}>TRANSPARENCIA DE COSTOS · SOLO EJEMPLO</Text>
   <Text style={s.text}>Envío hipotético: USD {(disclosure.principalUsdCents/100).toFixed(2)}</Text>
   <Text style={s.text}>Comisión ficticia: USD {(disclosure.hypotheticalServiceFeeUsdCents/100).toFixed(2)}</Text>
   <Text style={s.text}>Suma ilustrativa: USD {(disclosure.hypotheticalDisplayedTotalUsdCents/100).toFixed(2)}</Text>
   {disclosure.recipientAmountManualIllustration&&<Text style={s.text}>Receptor, tasa ingresada manualmente: {disclosure.recipientAmountManualIllustration} {disclosure.recipientAmountCurrency}. No garantizado.</Text>}
   <Text style={s.warn}>Costo total real DESCONOCIDO: pueden faltar comisiones bancarias, tarifas de tarjeta, margen de divisas e impuestos. Ningún proveedor ha cotizado.</Text>
  </View>}
  <Text style={s.warn}>No hay Coin ni Digital emitidas, cambio autorizado, saldos reales ni países operativos. Los MWD de prueba no son canjeables.</Text>
 </View>;
}
