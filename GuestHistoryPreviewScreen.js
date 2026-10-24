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
  wrapper:{backgroundColor:'#071321',borderRadius:14,padding:8,marginVertical:8},
  notice:{backgroundColor:'#263323',borderWidth:1,borderColor:'#7F7148',borderRadius:12,padding:13,marginBottom:16},
  heading:{color:'#F5D59A',fontSize:12,fontWeight:'800',letterSpacing:0.5},
  note:{color:'#E6D8B8',fontSize:12,marginTop:7,lineHeight:18},
  backButton:{backgroundColor:'#24556F',borderRadius:12,alignItems:'center',padding:15,marginVertical:15},
  backText:{color:'#FFFFFF',fontWeight:'800',fontSize:14,textAlign:'center'},
});
