// Vista educativa local: no llama Supabase y no modifica saldos.
import React,{useState} from 'react';
import {View,Text,TextInput,TouchableOpacity} from 'react-native';
import {amountToCents,formatMWD} from './src/demo-money.mjs';
import {DEMO_CORRIDORS} from './src/international-demo.mjs';
import {SOURCES,PAYOUTS,previewWalletRemittance} from './src/digital-money/wallet-remittance-preview.mjs';
const style={box:{backgroundColor:'#132e42',borderRadius:12,padding:15,marginVertical:9},
 text:{color:'#deebf2',lineHeight:21,marginVertical:5},
 warning:{color:'#ffe1a1',lineHeight:21,marginVertical:9},
 button:{backgroundColor:'#31566b',padding:12,borderRadius:9,marginVertical:4},
 input:{backgroundColor:'#294a60',padding:12,borderRadius:8,color:'white',marginVertical:6}};
function Choice({options,selected,onChoose}){
 return <View>{options.map(x=><TouchableOpacity key={x.id} accessibilityRole="button"
 onPress={()=>onChoose(x.id)} style={[style.button,selected===x.id&&{backgroundColor:'#137d77'}]}>
 <Text style={{color:'white',textAlign:'center'}}>{selected===x.id?'✓ ':''}{x.label}</Text>
 </TouchableOpacity>)}</View>;
}
export default function WalletRemittanceConceptScreen({walletBalanceCents=null}){
 const [source,setSource]=useState('demo_wallet'),[payout,setPayout]=useState('cash_pickup');
 const [destination,setDestination]=useState('NI'),[amount,setAmount]=useState('100');
 const [funding,setFunding]=useState('bank');
 const result=previewWalletRemittance({source,payout,destination,funding,hypotheticalUsdCents:amountToCents(amount)});
 const fmt=c=>Number.isSafeInteger(c)?formatMWD(c):'No disponible';
 return <View style={style.box}>
  <Text style={{color:'white',fontSize:20,fontWeight:'800'}}>Billetera → Remesa internacional · Diseño</Text>
  <Text style={style.warning}>SOLO PROTOTIPO. No convierte, envía ni reserva dinero. MWD son créditos ficticios. Coin y Digital todavía no están emitidas.</Text>
  <Text style={style.text}>Saldo de ejemplo en billetera: {Number.isSafeInteger(walletBalanceCents)?fmt(walletBalanceCents)+' MWD ficticios':'No disponible'}. No se convierte a USD.</Text>
  <Text style={style.text}>Origen propuesto</Text>
  <Choice options={SOURCES} selected={source} onChoose={setSource}/>
  <Text style={style.text}>Método futuro de entrega</Text>
  <Choice options={PAYOUTS} selected={payout} onChoose={setPayout}/>
  <Text style={style.text}>País ISO de destino de ejemplo</Text>
  <TextInput accessibilityLabel="País de destino" style={style.input} maxLength={2}
   autoCapitalize="characters" autoCorrect={false} placeholder="NI" placeholderTextColor="#a9c3cf"
   value={destination} onChangeText={x=>setDestination(x.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2))}/>
  <Text style={style.text}>Rutas de demostración: {DEMO_CORRIDORS.map(c=>c.code).join(', ')}</Text>
  <Text style={style.text}>Importe USD hipotético (NO es saldo de tu billetera)</Text>
  <TextInput style={style.input} accessibilityLabel="Importe hipotético USD"
   keyboardType="decimal-pad" placeholder="100" placeholderTextColor="#a9c3cf"
   value={amount} onChangeText={setAmount}/>
  {source==='external_usd_scenario'&&<Choice options={[
   {id:'bank',label:'Cuenta de origen imaginaria'},
   {id:'card',label:'Tarjeta de origen imaginaria'}]} selected={funding} onChoose={setFunding}/>}
  {!result?<Text style={style.warning}>Introduce una ruta de ejemplo y un monto hipotético válido entre 1 y 100,000 USD.</Text>:
  <View style={style.box}>
   <Text style={style.text}>Ruta: {result.origin} → {result.destination} ({result.destinationCurrency})</Text>
   <Text style={style.warning}>{result.blockReason}</Text>
   <Text style={style.text}>Requisitos para ese método: {result.requirements}</Text>
   {result.illustrativeUsdCents!==null?<View>
    <Text style={style.text}>Cantidad ficticia de ejemplo: {fmt(result.illustrativeUsdCents)} USD</Text>
    <Text style={style.text}>Comisión hipotética: {fmt(result.illustrativeFeeCents)} USD</Text>
    <Text style={style.text}>Total hipotético: {fmt(result.illustrativeTotalCents)} USD</Text>
    <Text style={style.text}>Importe receptor: {result.illustrativeReceiveCents===null?'Sin tipo de cambio real':fmt(result.illustrativeReceiveCents)+' USD ficticios'}</Text>
   </View>:<Text style={style.warning}>No hay cotización para MWD, Coin ni Digital.</Text>}
   <Text style={style.warning}>Pago disponible: NO · Banco conectado: NO · Fondos enviados: 0</Text>
  </View>}
 </View>;
}
