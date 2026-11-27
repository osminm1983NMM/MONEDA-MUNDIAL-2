// Root entry only for a separately packaged, disposable unified LAB build.
import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import DemoApp from './DemoApp';
import HostedFinancialLab from './HostedFinancialLab';

export default function UnifiedLab(){
 const [mode,setMode]=useState(null);
 return <SafeAreaProvider><SafeAreaView style={styles.page}>
  <Text style={styles.warning}>MONEDA MUNDIAL · LAB UNIFICADO · SIN DINERO REAL</Text>
  {mode===null?<View style={styles.menu}>
   <Text style={styles.text}>Elige un entorno de pruebas. Sus cuentas y saldos son independientes.</Text>
   <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setMode('demo')}><Text style={styles.label}>DEMO · Créditos ficticios MWD</Text></TouchableOpacity>
   <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setMode('financial')}><Text style={styles.label}>LAB financiero · Consultas de solo lectura</Text></TouchableOpacity>
  </View>:<>
   <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={()=>setMode(null)}><Text style={styles.label}>Volver a elegir entorno</Text></TouchableOpacity>
   <View style={styles.body}>{mode==='demo'?<DemoApp key="demo"/>:<HostedFinancialLab key="financial"/>}</View>
  </>}
 </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#09182a'},body:{flex:1},warning:{color:'#f4cc81',fontWeight:'700',padding:8,textAlign:'center'},menu:{padding:20,gap:16},text:{color:'#fff',fontSize:16},button:{backgroundColor:'#234f8e',padding:12,margin:4,borderRadius:8},label:{color:'#fff',textAlign:'center',fontWeight:'600'}});
