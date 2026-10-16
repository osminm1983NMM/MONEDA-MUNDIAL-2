// Guía visible al propietario. Casos estáticos, no ejecuta solicitudes.
import React,{useState} from 'react';
import {View,Text,TouchableOpacity} from 'react-native';
import {assessMockRefundCancellation,DEMO_REFUND_STATES} from './src/admin/mock-refund-cancellation-policy.mjs';
const labels={
 created_mock:'Creada · sin fondos',funded_mock:'Financiada (ficticia)',
 payout_pending_mock:'Entrega pendiente (ficticia)',payout_failed_mock:'Entrega fallida (ficticia)',
 refund_pending_mock:'Devolución solicitada (ficticia)',refund_failed_mock:'Devolución fallida (ficticia)',
 paid_mock:'Marcada como entregada (ficticia)',refunded_mock:'Devolución finalizada (ficticia)',
 cancelled_mock:'Cancelada sin financiación (ficticia)',
};
const st={bg:{backgroundColor:'#102d41',borderRadius:12,padding:14,marginVertical:12},
 text:{color:'#dceaf1',marginVertical:7,lineHeight:20},
 warn:{color:'#ffe0a4',marginVertical:8,lineHeight:20},
 btn:{backgroundColor:'#2d5266',padding:10,borderRadius:7,marginVertical:3}};
export default function MockRefundCancellationGuide(){
 const [state,setState]=useState('payout_pending_mock');
 const review=assessMockRefundCancellation(state);
 return <View style={st.bg}>
  <Text style={{color:'white',fontSize:19,fontWeight:'800'}}>Cancelaciones y devoluciones · Diseño</Text>
  <Text style={st.warn}>Ejemplos estáticos: NO conectados con remesas, bancos ni solicitudes de usuarios. Ningún botón ejecuta un reembolso.</Text>
  {DEMO_REFUND_STATES.map(value=><TouchableOpacity key={value} accessibilityRole="button"
   style={[st.btn,state===value&&{backgroundColor:'#127d77'}]} onPress={()=>setState(value)}>
   <Text style={{color:'white'}}>{state===value?'✓ ':''}{labels[value]}</Text>
  </TouchableOpacity>)}
  <View style={{borderTopWidth:1,borderColor:'#587080',marginTop:10,paddingTop:8}}>
   <Text style={st.text}>Criterio del ejemplo: {review.explanation}</Text>
   <Text style={st.text}>Acción de simulación propuesta: {review.nextAction}</Text>
   <Text style={st.warn}>Revisión humana: {review.humanReviewNeeded?'Sí':'Según controles adicionales'} · Pagos/reembolsos reales: DESHABILITADOS.</Text>
  </View>
 </View>;
}
