// Vista pública offline: no exige cuenta, no lee fondos ni consulta servicios.
// No concede permisos ni permite usar dinero, Coin, Digital o servicios reales.
import React from 'react';
import {View,Text} from 'react-native';
import {buildProjectLaunchStatus} from './src/digital-money/project-launch-status.mjs';
import {getProviderResearchOverview} from './src/digital-money/provider-research-overview.mjs';
const s={card:{backgroundColor:'#203d58',borderRadius:10,padding:13,marginVertical:7},text:{color:'#dceaf2',marginVertical:5},alert:{color:'#ffe1a1',marginVertical:6}};
export default function GuestReadinessPreviewScreen(){
 const status=buildProjectLaunchStatus({destination:'HN',asOf:'2026-10-17'});
 const providers=getProviderResearchOverview({destination:'HN',method:'cash_pickup',asOf:'2026-10-17'});
 return <View style={s.card}>
  <Text style={{color:'#fff',fontSize:19,fontWeight:'bold'}}>Preparación pública del proyecto</Text>
  <Text style={s.alert}>SOLO INVESTIGACIÓN · SIN CUENTA · SIN FONDOS REALES</Text>
  <Text style={s.text}>Ruta prioritaria: Estados Unidos → Honduras. Nicaragua y demás países siguen en el catálogo mundial.</Text>
  <Text style={s.text}>Requisitos financieros pendientes de verificación: {status.fiatRequirementsUnverified} de {status.fiatRequirementCount}.</Text>
  <Text style={s.text}>Proveedores potenciales para estudiar: {providers.candidates.map(p=>p.name).join(', ')}.</Text>
  <Text style={s.text}>Contratos financieros confirmados: {providers.confirmedProviders}. Países operativos: {status.liveCountries}.</Text>
  <Text style={s.text}>Coin: no emitida. Digital: no emitida. Conversión Coin ↔ Digital: no disponible.</Text>
  <Text style={s.alert}>No ingreses datos bancarios, documentos personales ni claves aquí. No hay retiros ni depósitos reales.</Text>
 </View>;
}
