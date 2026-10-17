import React,{useState} from 'react';
import {View,Text,TextInput} from 'react-native';
import WalletSafetyPreviewScreen from './WalletSafetyPreviewScreen';
import {compareInternationalPriceDemo} from './src/digital-money/design-and-comparison.mjs';
import {previewCoinToDigitalScenario,previewDigitalToCoinScenario} from './src/digital-money/coin-to-digital-design.mjs';
import {CRYPTO_CONCEPT_OPTIONS,getCryptoConceptCard} from './src/digital-money/crypto-ui-state.mjs';
import {previewCoinTradeScenario} from './src/digital-money/coin-market-demo.mjs';
import {getCoinLaunchExample,previewCoinLaunchFromDollars} from './src/digital-money/coin-launch-presets.mjs';
import {previewCoinUnlockScenario} from './src/digital-money/coin-unlock-scenarios.mjs';
import {previewCoinPoolImpact} from './src/digital-money/coin-pool-impact-demo.mjs';
const s={panel:{backgroundColor:'#152b42',borderRadius:12,padding:14,marginVertical:9},text:{color:'#e1edf4',marginVertical:6},warning:{color:'#f3c887',marginVertical:8},input:{color:'#fff',backgroundColor:'#28465c',borderRadius:7,padding:11,marginVertical:7}};
export default function DigitalMoneyConceptScreen(){
 const [currency,setCurrency]=useState('PEN'),[price,setPrice]=useState(''),[rate,setRate]=useState(''),[seller,setSeller]=useState(''),[hypothesis,setHypothesis]=useState('');
 const [coinUnits,setCoinUnits]=useState(''),[digitalUnits,setDigitalUnits]=useState(''),[coinUsd,setCoinUsd]=useState(''),[digitalUsd,setDigitalUsd]=useState('');
 const [tradeSide,setTradeSide]=useState('buy'),[tradeUnits,setTradeUnits]=useState(''),[tradeFee,setTradeFee]=useState('0');
 const [launchExample,setLaunchExample]=useState('100m');
 const [distributionPlan,setDistributionPlan]=useState('balanced'),[unlockMonth,setUnlockMonth]=useState('0');
 const [poolSide,setPoolSide]=useState('buy_coin'),[poolInput,setPoolInput]=useState('');
 const [selectedAsset,setSelectedAsset]=useState('coin');
 const selectedCard=getCryptoConceptCard(selectedAsset);
 const poolImpact=previewCoinPoolImpact({poolCoinUnits:'100000',poolQuoteUsdCents:'1000000',side:poolSide,tradeInputUnits:poolInput});
 const launch=previewCoinLaunchFromDollars(getCoinLaunchExample(launchExample));
 // Evitar que los campos vacíos, 1e2 o 0x10 se interpreten como cifras válidas.
 const monthValid=/^(?:0|[1-9][0-9]{0,2})$/.test(unlockMonth);
 const feeValid=/^(?:0|[1-9][0-9]{0,3})$/.test(tradeFee);
 const vesting=launch&&monthValid?previewCoinUnlockScenario({maximumSupplyUnits:launch.maximumSupplyUnits,planId:distributionPlan,month:Number(unlockMonth)}):null;
 const trade=feeValid?previewCoinTradeScenario({side:tradeSide,coinUnits:tradeUnits,coinUsdScenario:coinUsd,feeBps:Number(tradeFee)}):null;
 const swap=previewCoinToDigitalScenario({coinUnits,coinUsdScenario:coinUsd,digitalUsdScenario:digitalUsd});
 const reverseSwap=previewDigitalToCoinScenario({digitalUnits,coinUsdScenario:coinUsd,digitalUsdScenario:digitalUsd});
 const q=compareInternationalPriceDemo({localCurrency:currency,localPrice:price,localUnitsPerUsd:rate,sellerUsd:seller,tokenUsdExample:hypothesis});
 return <View style={s.panel}>
  <Text style={s.text}>MONEDA MUNDIAL · DOS FUTUROS ACTIVOS CRIPTO</Text>
  <Text style={s.warning}>INVESTIGACIÓN: no hay tokens emitidos ni cotizaciones oficiales.</Text>
  <View style={{flexDirection:'row',marginVertical:5}}>
    {CRYPTO_CONCEPT_OPTIONS.map(key=><Text key={key} accessibilityRole="button"
      accessibilityLabel={'Ver '+getCryptoConceptCard(key).title}
      onPress={()=>setSelectedAsset(key)}
      style={[s.text,{flex:1,textAlign:'center',padding:12,borderRadius:8,
       backgroundColor:selectedAsset===key?'#275c82':'#28465c'}]}>
      {key==='coin'?'Coin · variable':'Digital · estable deseada'}
    </Text>)}
  </View>
  {selectedCard&&<View style={s.panel}>
    <Text style={s.text}>{selectedCard.title}</Text>
    <Text style={s.text}>{selectedCard.subtitle}</Text>
    <Text style={s.warning}>{selectedCard.status} · {selectedCard.reference}</Text>
    <Text style={s.text}>{selectedCard.description}</Text>
    <Text style={s.text}>{selectedCard.heading}:</Text>
    {selectedCard.highlights.map(line=><Text key={line} style={s.text}>• {line}</Text>)}
    <Text style={s.warning}>Saldo real: ninguno · Comprar, vender, convertir y pagar: NO disponibles.</Text>
  </View>}
  <View style={s.panel}>
   <Text style={s.text}>COIN · COMPRAR / VENDER (PRESUPUESTO ILUSTRATIVO)</Text>
   <Text style={s.warning}>NO son órdenes. No existe token emitido ni mercado o proveedor conectado.</Text>
   <View style={{flexDirection:'row'}}>
    {['buy','sell'].map(side=><Text key={side} accessibilityRole="button"
      accessibilityLabel={side==='buy'?'Simular compra Coin':'Simular venta Coin'}
      onPress={()=>setTradeSide(side)}
      style={[s.text,{flex:1,padding:11,textAlign:'center',borderRadius:8,
       backgroundColor:tradeSide===side?'#275c82':'#28465c'}]}>
      {side==='buy'?'Comprar · ejemplo':'Vender · ejemplo'}
    </Text>)}
   </View>
   <Text style={s.text}>Cantidad hipotética de Coin</Text>
   <TextInput style={s.input} value={tradeUnits} onChangeText={setTradeUnits}
      keyboardType="decimal-pad" placeholder="Ejemplo: 10" placeholderTextColor="#aec5cf"/>
   <Text style={s.text}>Precio MANUAL por Coin en USD (hipotético, no cotización real)</Text>
   <TextInput style={s.input} value={coinUsd} onChangeText={setCoinUsd}
     keyboardType="decimal-pad" placeholder="Ejemplo 0.25" placeholderTextColor="#aec5cf"/>
   <Text style={s.text}>Comisión hipotética en puntos básicos (0-1000; 100 = 1 %)</Text>
   <TextInput style={s.input} value={tradeFee} onChangeText={setTradeFee}
      keyboardType="number-pad" placeholder="Puntos básicos, ejemplo 100 = 1%" placeholderTextColor="#aec5cf"/>
   {trade?<View>
      <Text style={s.text}>Importe bruto ilustrativo: {trade.hypotheticalGrossUsd} USD</Text>
      <Text style={s.text}>Comisión hipotética: {trade.illustrativeFeeUsd} USD</Text>
      <Text style={s.text}>{tradeSide==='buy'?'Costo total hipotético':'Ingreso hipotético de venta'}: {tradeSide==='buy'?trade.hypotheticalBuyerTotalUsd:trade.hypotheticalSellerProceedsUsd} USD</Text>
      <Text style={s.warning}>No incluye spreads, comisiones de red, impuestos ni conversión bancaria. Ninguna operación puede ejecutarse.</Text>
    </View>:<Text style={s.warning}>Ingresa cantidades válidas y un precio ficticio de Coin.</Text>}
  </View>
  <View style={s.panel}>
   <Text style={s.text}>OFERTA Y PRECIO INICIAL · EJEMPLOS NO OFICIALES</Text>
   <Text style={s.warning}>Sin emisión, sin pool, sin mercado. Ninguna cifra representa dinero disponible.</Text>
   <View style={{flexDirection:'row'}}>
    {['100m','1000m'].map(id=><Text key={id} accessibilityRole="button"
     accessibilityLabel={id==='100m'?'Estudiar 100 millones':'Estudiar mil millones'}
     onPress={()=>setLaunchExample(id)}
     style={[s.text,{flex:1,textAlign:'center',padding:10,
      backgroundColor:launchExample===id?'#275c82':'#28465c'}]}>
     {id==='100m'?'100 millones':'1,000 millones'}
    </Text>)}
   </View>
   {launch&&<View>
    <Text style={s.text}>Oferta máxima hipotética: {launch.maximumSupplyUnits} Coin</Text>
    <Text style={s.text}>Circulación inicial hipotética: {launch.initiallyCirculatingUnits} Coin</Text>
    <Text style={s.text}>Liquidez ficticia del ejemplo: {launch.poolQuoteUsdScenario} USD frente a {launch.illustrativePoolCoinUnits} Coin</Text>
    <Text style={s.text}>Referencia matemática por Coin: {launch.hypotheticalOpeningReferencePriceUsd} USD</Text>
    <Text style={s.warning}>No es precio justo, cotización ejecutable, capital recaudado ni garantía de liquidez.</Text>
   </View>}
  </View>
  <View style={s.panel}>
    <Text style={s.text}>COIN · DISTRIBUCIÓN Y DESBLOQUEO (EJEMPLOS)</Text>
    <Text style={s.warning}>No son monedas emitidas ni cantidades oficialmente reservadas.</Text>
    <View style={{flexDirection:'row'}}>
      {['balanced','broad_distribution'].map((id)=><Text key={id}
       accessibilityRole="button" onPress={()=>setDistributionPlan(id)}
       style={[s.text,{flex:1,padding:10,textAlign:'center',
        backgroundColor:distributionPlan===id?'#275c82':'#28465c'}]}>
       {id==='balanced'?'Plan A':'Plan B'}
      </Text>)}
    </View>
    <Text style={s.text}>Mes hipotético desde el lanzamiento (0 a 120)</Text>
    <TextInput style={s.input} value={unlockMonth} onChangeText={setUnlockMonth}
      keyboardType="number-pad" placeholder="Ejemplo 12" placeholderTextColor="#aec5cf"/>
    {vesting?<View>
      <Text style={s.text}>Monedas hipotéticamente desbloqueadas: {vesting.hypotheticallyUnlockedUnits}</Text>
      <Text style={s.text}>Monedas hipotéticamente bloqueadas: {vesting.hypotheticallyLockedUnits}</Text>
      {vesting.entries.map(row=><Text key={row.bucket} style={s.text}>
        {row.bucket}: {row.allocationPercent}% asignación; {row.hypotheticallyUnlockedUnits} desbloqueadas de ejemplo
      </Text>)}
      <Text style={s.warning}>Desbloqueadas NO significa circulantes, vendibles ni garantizadas.</Text>
    </View>:<Text style={s.warning}>Indica un mes entero entre 0 y 120.</Text>}
  </View>
  <View style={s.panel}>
    <Text style={s.text}>COIN · IMPACTO DE COMPRA / VENTA EN LIQUIDEZ FICTICIA</Text>
    <Text style={s.warning}>Pool hipotético de 100,000 Coin y 10,000 USD imaginarios. No existe mercado.</Text>
    <View style={{flexDirection:'row'}}>
      {['buy_coin','sell_coin'].map(side=><Text key={side} accessibilityRole="button"
       onPress={()=>{setPoolSide(side);setPoolInput('');}}
       style={[s.text,{flex:1,textAlign:'center',padding:10,
        backgroundColor:poolSide===side?'#275c82':'#28465c'}]}>
        {side==='buy_coin'?'Comprar (USD cents)':'Vender (Coin)'}
      </Text>)}
    </View>
    <Text style={s.text}>{poolSide==='buy_coin'?'Centavos ficticios para comprar (100 = $1)':'Unidades ficticias de Coin para vender'}</Text>
    <TextInput style={s.input} value={poolInput} keyboardType="number-pad"
     onChangeText={setPoolInput} placeholder="Ejemplo: 10000" placeholderTextColor="#aec5cf"/>
    {poolImpact?<View>
      <Text style={s.text}>Precio spot inicial ficticio: {poolImpact.initialSpotPriceUsd} USD</Text>
      <Text style={s.text}>Precio spot posterior ficticio: {poolImpact.hypotheticalAfterTradeSpotPriceUsd} USD</Text>
      <Text style={s.text}>Variación spot aproximada: {poolImpact.hypotheticalSpotPriceChangeBps} puntos básicos</Text>
      {poolImpact.highSpotPriceImpactWarning&&<Text style={s.warning}>ATENCIÓN: efecto hipotético de precio elevado. Una cotización real podría ser muy diferente.</Text>}
      <Text style={s.warning}>No es precio ejecutable, deslizamiento real ni promesa de rentabilidad.</Text>
    </View>:<Text style={s.warning}>Introduce un importe hipotético válido para ver el impacto.</Text>}
  </View>
  <Text style={s.text}>MWD actuales: créditos de prueba sin valor financiero. NO son criptomonedas.</Text>
  <Text style={s.text}>Moneda Mundial Digital: concepto de moneda estable para pagos, sujeto a emisor autorizado. Paridad NO operativa.</Text>
  <Text style={s.text}>Moneda Mundial Coin: concepto de criptomoneda de valor variable. Sin emisión, oferta total, cotización ni blockchain elegidos.</Text>
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
  <View style={s.panel}>
   <Text style={s.text}>COIN → DIGITAL · CONVERSIÓN HIPOTÉTICA (NO OPERATIVA)</Text>
   <Text style={s.text}>Cantidad imaginaria de Coin</Text>
   <TextInput style={s.input} keyboardType="decimal-pad" value={coinUnits} onChangeText={setCoinUnits} placeholder="Ejemplo: 10" placeholderTextColor="#aec5cf"/>
   <Text style={s.text}>Precio en USD imaginario por Coin: {coinUsd||'sin definir'} (introducido arriba)</Text>
   <Text style={s.text}>Precio en USD imaginario por Digital (NO paridad aprobada)</Text>
   <TextInput style={s.input} keyboardType="decimal-pad" value={digitalUsd} onChangeText={setDigitalUsd} placeholder="Ejemplo educativo: 1" placeholderTextColor="#aec5cf"/>
   {swap ? <View>
     <Text style={s.text}>Valor comparado: {swap.hypotheticalUsdValue} USD imaginarios</Text>
     <Text style={s.text}>Unidades Digital hipotéticas: {swap.hypotheticalNetDigitalUnits}</Text>
     <Text style={s.warning}>Comisiones de red, impuestos, mercado y liquidez no incluidos. NO existe mercado ni botón para intercambiar.</Text>
   </View> : <Text style={s.text}>Rellena los campos para calcular un escenario ficticio.</Text>}
  </View>
  <View style={s.panel}>
    <Text style={s.text}>DIGITAL → COIN · CONVERSIÓN HIPOTÉTICA (NO OPERATIVA)</Text>
    <Text style={s.text}>Cantidad imaginaria de Digital</Text>
    <TextInput style={s.input} keyboardType="decimal-pad" value={digitalUnits} onChangeText={setDigitalUnits} placeholder="Ejemplo: 2.5" placeholderTextColor="#aec5cf"/>
    <Text style={s.text}>Para comparar se usan los mismos precios MANUALES escritos arriba.</Text>
    {reverseSwap?<View>
      <Text style={s.text}>Valor hipotético: {reverseSwap.hypotheticalUsdValue} USD imaginarios</Text>
      <Text style={s.text}>Coin hipotéticas recibidas: {reverseSwap.hypotheticalNetCoinUnits}</Text>
      <Text style={s.warning}>Sin liquidez, paridad, precio ni emisión verificadas. Ninguna compra está habilitada.</Text>
    </View>:<Text style={s.text}>Introduce Digital y los dos precios hipotéticos para realizar el cálculo inverso.</Text>}
  </View>
  <WalletSafetyPreviewScreen />
  <Text style={s.warning}>La conversión no garantiza ahorro ni determina el precio del producto. No incluye comisiones, impuestos ni tipo de cambio verificado. Requiere aceptación del vendedor.</Text>
 </View>;
}
