import React,{useState} from 'react';
import {View,Text,TouchableOpacity,TextInput,Share,Linking,Alert} from 'react-native';
import {searchWorldResearchCountries} from './src/digital-money/worldwide-research-countries.mjs';
import {getMobileProviderOutreachDraft} from './src/digital-money/mobile-provider-outreach.mjs';
import {RESEARCH_DESTINATIONS} from './src/digital-money/project-launch-status.mjs';
import {getProviderResearchOverview,RESEARCH_PAYOUTS} from './src/digital-money/provider-research-overview.mjs';
const style={panel:{backgroundColor:'#142e45',borderRadius:12,padding:14,marginVertical:8},
 text:{color:'#dfedf6',marginVertical:5},alert:{color:'#ffdc97',marginVertical:8},
 btn:{backgroundColor:'#284c6a',padding:10,borderRadius:7,marginVertical:3}};
export default function ProviderResearchScreen({language='es'}){
 const [destination,setDestination]=useState('HN');
 const [method,setMethod]=useState('bank_account');
 const [countrySearch,setCountrySearch]=useState('');
 const [catalogueCountry,setCatalogueCountry]=useState(null);
 const result=getProviderResearchOverview({destination,method});
 const shareDraft=async providerId=>{
  const draft=getMobileProviderOutreachDraft({providerId,destination});
  if(!draft)return;
  try{await Share.share({message:draft.message,title:draft.subject});}
  catch{Alert.alert('No se pudo compartir','Puedes volver a intentar más tarde. No se envió automáticamente.');}
 };
 const openOfficialForm=async providerId=>{
  const draft=getMobileProviderOutreachDraft({providerId,destination});
  if(!draft)return;
  // Android 11+ package visibility can make canOpenURL return false even when
  // a normal HTTPS link opens in the user's browser. URLs are fixed by the
  // local, allowlisted provider catalogue; no user-supplied link is accepted.
  try{await Linking.openURL(draft.contactUrl);}
  catch{Alert.alert('No se pudo abrir','Comprueba la conexión o abre el formulario desde el navegador.');}
 };
 return <View style={style.panel}>
  <Text style={{color:'#fff',fontSize:20,fontWeight:'800'}}>Proveedores para evaluar</Text>
  <Text style={style.alert}>SOLO INVESTIGACIÓN. Ningún candidato ha firmado contrato ni confirmado que pueda mover fondos para Moneda Mundial.</Text>
  <Text style={style.text}>Destino de estudio (no país activo)</Text>
  {Object.entries(RESEARCH_DESTINATIONS).map(([code,c])=><TouchableOpacity accessibilityRole="button" key={code} style={style.btn} onPress={()=>setDestination(code)}>
   <Text style={style.text}>{destination===code?'✓ ':''}{c.country} ({code})</Text>
  </TouchableOpacity>)}
  <Text style={style.text}>Consulta mundial de países (catálogo, ninguno habilitado)</Text>
  <TextInput accessibilityLabel="Buscar país del mundo" value={countrySearch} onChangeText={setCountrySearch}
   placeholder="País o código ISO (ej.: España, México, TR)" placeholderTextColor="#b9cfe1"
   style={{backgroundColor:'#284c6a',color:'#fff',padding:10,borderRadius:8}}/>
  {searchWorldResearchCountries(countrySearch,12,language).map(c=><TouchableOpacity key={c.code} style={style.btn}
    accessibilityRole="button" onPress={()=>setCatalogueCountry(c)}>
    <Text style={style.text}>{catalogueCountry?.code===c.code?'✓ ':''}{c.name} ({c.code}) · {language==='en'?'Under research':'En investigación'}</Text>
   </TouchableOpacity>)}
  {catalogueCountry&&<Text style={style.alert}>{catalogueCountry.name} ({catalogueCountry.code}): incluido en el catálogo mundial. Sin proveedor, moneda de pago ni ruta real confirmada.</Text>}
  <Text style={style.text}>Modalidad a consultar</Text>
  {Object.entries(RESEARCH_PAYOUTS).map(([id,label])=><TouchableOpacity accessibilityRole="button" key={id} style={style.btn} onPress={()=>setMethod(id)}>
   <Text style={style.text}>{method===id?'✓ ':''}{label}</Text>
  </TouchableOpacity>)}
  {result&&<View>
   <Text style={style.text}>Ruta en investigación: Estados Unidos → {result.country}</Text>
   <Text style={style.alert}>Proveedores confirmados: {result.confirmedProviders} · Transferencias reales: NO.</Text>
   {result.candidates.map(p=><View key={p.providerId} style={style.btn}>
    <Text style={{color:'#fff',fontWeight:'700'}}>{p.name}</Text>
    <Text style={style.text}>{p.study}</Text>
    <Text style={style.text}>Modalidad para investigar: {p.candidateMethodInResearch?'Sí':'No priorizada'}</Text>
    <Text style={style.text}>Requisitos documentales aún pendientes: {p.documentationMissing} / {p.documentationRequired}</Text>
    <Text style={style.alert}>Cobertura sin confirmar · Sin convenio ni sandbox otorgado.</Text>
    {destination==='HN'&&<View>
     <Text style={style.text}>Desde tu Samsung: comparte o copia el borrador y después abre el formulario oficial. Debes revisar, pegar y enviar tú mismo el mensaje. No se enviará automáticamente.</Text>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Compartir borrador de '+p.name}
      style={style.btn} onPress={()=>shareDraft(p.providerId)}>
      <Text style={style.text}>Compartir borrador de consulta · {p.name}</Text>
     </TouchableOpacity>
     <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Abrir contacto oficial de '+p.name}
      style={style.btn} onPress={()=>openOfficialForm(p.providerId)}>
      <Text style={style.text}>Abrir formulario oficial · {p.name}</Text>
     </TouchableOpacity>
     <Text style={style.alert}>Abrir o compartir no envía automáticamente un mensaje. Revisa y decide si deseas contactar.</Text>
    </View>}
   </View>)}
   <Text style={style.alert}>{result.nextAction}</Text>
  </View>}
  <Text style={style.alert}>Coin y Digital no están emitidas. No solicitar ni introducir documentos personales o credenciales de bancos en esta pantalla.</Text>
 </View>;
}
