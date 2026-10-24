// Vista de prueba accesible sin cuenta: usa el MISMO diseño de Historial reciente.
// Nunca llama a Supabase, comparte recibos ni modifica operaciones.
import React, {useMemo, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import DemoHistoryRecentScreen from './DemoHistoryRecentScreen';
import {GUEST_HISTORY_PREVIEW_USER,guestHistoryFixture} from './src/demo-history-guest-fixture.mjs';

export default function GuestHistoryPreviewScreen({language='es',onBack}) {
  const [selectedReceiptId,setSelectedReceiptId]=useState(null);
  const operations=useMemo(() => guestHistoryFixture(),[]);
  const english=language==='en';
  return <View style={styles.wrapper}>
    <View style={styles.notice}>
      <Text style={styles.heading}>{english ? 'HISTORY PREVIEW WITH INVENTED DATA' : 'VISTA PREVIA DEL HISTORIAL CON DATOS INVENTADOS'}</Text>
      <Text style={styles.note}>{english
        ? 'These are imaginary examples, not your account or actual transfers. No sign-in or payment is possible here.'
        : 'Estos son ejemplos inventados, no tu cuenta ni transferencias reales. Aquí no puedes iniciar pagos.'}</Text>
    </View>
    <DemoHistoryRecentScreen
      operations={operations} userId={GUEST_HISTORY_PREVIEW_USER} language={language}
      selectedReceiptId={selectedReceiptId} setSelectedReceiptId={setSelectedReceiptId}
      allowShare={false} allowRefresh={false} />
    <TouchableOpacity accessibilityRole="button" style={styles.backButton} onPress={onBack}
      accessibilityLabel={english ? 'Back to Moneda Mundial tour' : 'Volver al recorrido de Moneda Mundial'}>
      <Text style={styles.backText}>{english ? 'Back to Moneda Mundial tour' : 'Volver al recorrido de Moneda Mundial'}</Text>
    </TouchableOpacity>
  </View>;
}

const styles=StyleSheet.create({
  wrapper:{backgroundColor:'#070D21',borderColor:'#263B73',borderWidth:1,borderRadius:22,padding:12,marginVertical:8},
  notice:{backgroundColor:'#27213F',borderWidth:1,borderColor:'#7560BE',borderRadius:16,padding:16,marginBottom:18},
  heading:{color:'#F8DFA7',fontSize:13,fontWeight:'800',letterSpacing:0.5},
  note:{color:'#E1DDF3',fontSize:14,marginTop:8,lineHeight:21},
  backButton:{backgroundColor:'#283F83',borderColor:'#607DE0',borderWidth:1,borderRadius:14,alignItems:'center',padding:16,marginVertical:16},
  backText:{color:'#FFFFFF',fontWeight:'800',fontSize:15,textAlign:'center'},
});
