import React,{useState} from 'react';
import {View,Text,TextInput,StyleSheet,TouchableOpacity} from 'react-native';
import {buildInternationalDemoPlan,DEMO_PAYOUT_METHODS} from './src/digital-money/international-demo-planner.mjs';
import {buildBeneficiaryVerificationChecklistDemo} from './src/digital-money/beneficiary-verification-checklist-demo.mjs';
import {assessInternationalProviderCandidateDemo} from './src/digital-money/international-provider-assessment-demo.mjs';
const s=StyleSheet.create({box:{backgroundColor:'#13253e',borderRadius:12,padding:16,marginTop:10},heading:{color:'#fff',fontSize:19,fontWeight:'bold',marginBottom:10},text:{color:'#d4e0f1',marginBottom:8},notice:{color:'#ffda88',marginBottom:10},input:{backgroundColor:'#243957',color:'white',padding:12,borderRadius:8,marginBottom:10}});
export default function InternationalPlannerDemoScreen(){
 const [origin,setOrigin]=useState('US');
 const [destination,setDestination]=useState('HN');
 const [amount,setAmount]=useState('25.00');
 const [method,setMethod]=useState('bank_account');
 const plan=buildInternationalDemoPlan({originCode:origin,destinationCode:destination,amountUSD:amount,payoutMethod:method});
 const verification=buildBeneficiaryVerificationChecklistDemo(plan);
 const providerAssessment=assessInternationalProviderCandidateDemo(plan);
 return <View style={s.box}>
  <Text style={s.heading}>Transferencia internacional — planificación</Text>
  <Text style={s.notice}>SOLO DEMOSTRACIÓN. No envía fondos, no genera tasa de cambio real ni habilita país alguno.</Text>
  <Text style={s.text}>País de origen (ISO, 2 letras)</Text>
  <TextInput accessibilityLabel="País origen" style={s.input} autoCapitalize="characters" maxLength={2} value={origin} onChangeText={setOrigin}/>
  <Text style={s.text}>País destino (ISO, 2 letras)</Text>
  <TextInput accessibilityLabel="País destino" style={s.input} autoCapitalize="characters" maxLength={2} value={destination} onChangeText={setDestination}/>
  <Text style={s.text}>Cantidad de referencia en USD (solo para planificación)</Text>
  <TextInput accessibilityLabel="Importe simulado USD" style={s.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount}/>
  <Text style={s.heading}>Forma de entrega propuesta (no disponible)</Text>
  {DEMO_PAYOUT_METHODS.map(m=><TouchableOpacity key={m.id} accessibilityRole="button" onPress={()=>setMethod(m.id)}
    style={[s.input,method===m.id&&{borderWidth:1,borderColor:'#ffda88'}]}>
    <Text style={s.text}>{method===m.id?'◉':'○'} {m.label}</Text>
  </TouchableOpacity>)}
  {!plan?<Text style={s.notice}>Comprueba ambos códigos de país (distintos) y el importe positivo con máximo dos decimales.</Text>:<>
   <Text style={s.text}>Ruta solicitada: {plan.originCode} → {plan.destinationCode}</Text>
   <Text style={s.text}>Importe de referencia: {(plan.amountCents/100).toFixed(2)} USD</Text>
   <Text style={s.text}>Entrega propuesta: {plan.payoutMethodLabel}. Verificación del beneficiario: pendiente.</Text>
   <Text style={s.notice}>ESTADO: NO HABILITADA. No hay comisión, proveedor, tasa ni importe de entrega confirmados.</Text>
   <Text style={s.heading}>Requisitos antes de cualquier activación</Text>
   {plan.requirements.map((line,index)=><Text key={index} style={s.text}>• {line}</Text>)}
   <Text style={s.heading}>Verificación del beneficiario (pendiente)</Text>
   {verification?.checklist.map(item=><Text key={item.id} style={s.text}>○ {item.label} — pendiente de proveedor autorizado</Text>)}
   <Text style={s.heading}>Revisión de futuro proveedor (sin conexión)</Text>
   <Text style={s.notice}>Ningún proveedor está integrado ni autorizado para esta ruta. No existe cotización ni entrega disponible.</Text>
   {providerAssessment?.missing.map(item=><Text style={s.text} key={item.id}>○ {item.label} — no verificado</Text>)}
   <Text style={s.notice}>No introduzcas nombre, identificación, tarjeta ni cuenta bancaria aquí. La verificación real todavía no está disponible.</Text>
  </>}
 </View>;
}
