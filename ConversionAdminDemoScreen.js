// Administración de cotizaciones SINTÉTICAS. Nunca permite pagos reales.
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,Alert} from 'react-native';
const {translateText}=require('./i18n');
const c={card:{backgroundColor:'#182d46',padding:15,marginTop:15,borderRadius:12},title:{color:'#fff',fontWeight:'700',fontSize:19,marginBottom:8},text:{color:'#d4e0f1',marginBottom:8},warn:{color:'#ffda92',marginVertical:7},input:{backgroundColor:'#233a58',padding:13,borderRadius:9,color:'#fff',marginBottom:10},btn:{backgroundColor:'#2867df',padding:13,borderRadius:9,marginBottom:9},btnText:{color:'#fff',textAlign:'center',fontWeight:'700'}};
const micro=x=>(Number(x||0)/1000000).toLocaleString('es-US',{maximumFractionDigits:6});
const Btn=({title,onPress,disabled})=><TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[c.btn,disabled&&{opacity:0.45}]}><Text style={c.btnText}>{title}</Text></TouchableOpacity>;
export default function ConversionAdminDemoScreen({supabase,language='es'}){
const tr=(v)=>translateText(v,language);
  const [data,setData]=useState(null),[rate,setRate]=useState(''),[fee,setFee]=useState(''),[enabled,setEnabled]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function refresh(){
    const {data:next,error:e}=await supabase.rpc('mwd_owner_conversion_dashboard_demo');
    if(e)throw e;
    setData(next);setRate(String(next.stablePerCoin));setFee(String(next.feeBps));
    setEnabled(next.active);setReason('');
  }
  useEffect(()=>{let active=true;supabase.rpc('mwd_owner_conversion_dashboard_demo').then(({data:next,error:e})=>{if(!active)return;if(e){setError(e.message);return;}setData(next);setRate(String(next.stablePerCoin));setFee(String(next.feeBps));setEnabled(next.active);}).catch(e=>{if(active)setError(e.message)});return()=>{active=false};},[supabase]);
  async function save(){
    if(busy||!data)return;
    const r=Number(rate.replace(',','.')),f=Number(fee);
    if(!Number.isFinite(r)||r<0.01||r>5||!/^\d+(?:[.,]\d{1,8})?$/.test(rate.trim())||!/^\d+$/.test(fee.trim())||f<0||f>500||reason.trim().length<8){setError('Verifica tasa (0.01–5), comisión (0–500 pb) y motivo (8 caracteres mínimo).');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const {error:e}=await supabase.rpc('mwd_owner_conversion_policy_demo',{p_active:enabled,p_stable_per_coin:r,p_fee_bps:f,p_reason:reason.trim(),p_expected_updated_at:data.updatedAt});
      if(e)throw e;
      await refresh();setNotice('Política de simulación guardada y auditada.');
    }catch(e){setError(e.message||'No se pudo guardar');}
    finally{setBusy(false);}
  }
  function approve(){Alert.alert('Cambiar simulador ficticio','El cambio modifica cotizaciones de prueba, nunca dinero real.',[{text:'Cancelar',style:'cancel'},{text:'Confirmar',onPress:save}]);}
  return <View style={c.card}>
    <Text style={c.title}>{tr('Control Coin / Estable')}</Text>
    <Text style={c.warn}>{tr('ADMINISTRACIÓN DE PRUEBA: sin mercado, respaldo ni dinero real.')}</Text>
    {!!error&&<Text style={c.warn}>{error}</Text>}
    {!!notice&&<Text style={c.text}>{notice}</Text>}
    {!data?<Btn title={tr('Cargar panel')} onPress={()=>refresh().catch(e=>setError(e.message))}/>:<>
      <Text style={c.text}>Simulador: {data.active?'Activo':'PAUSADO'}</Text>
      <Text style={c.text}>Conversiones: {data.conversionCount} • Cotizaciones: {data.quoteCount} • Vigentes: {data.activeQuoteCount}</Text>
      <Text style={c.text}>Usuarios con billetera demo: {data.walletCount}</Text>
      <Text style={c.text}>Saldos en bolsa ficticia: COIN {micro(data.poolBalancesMicro?.COIN)} · ESTABLE {micro(data.poolBalancesMicro?.STABLE)}</Text>
      <Text style={c.text}>Asientos descuadrados: {data.unbalancedJournalGroups}; incompletos: {data.incompleteJournals}</Text>
      <Text style={c.text}>{tr('Precio sintético de 1 COIN en STABLE')}</Text>
      <TextInput accessibilityLabel="Precio ficticio" style={c.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad"/>
      <Text style={c.text}>{tr('Comisión en puntos básicos (25 = 0.25%)')}</Text>
      <TextInput accessibilityLabel="Comisión ficticia" style={c.input} value={fee} onChangeText={setFee} keyboardType="number-pad"/>
      <Btn title={enabled?'✓ Cotizaciones HABILITADAS (tocar para pausar)':'⏸ Cotizaciones PAUSADAS (tocar para reanudar)'} disabled={busy} onPress={()=>setEnabled(v=>!v)}/>
      <Text style={c.text}>{tr('Motivo obligatorio y permanente del cambio')}</Text>
      <TextInput accessibilityLabel="Motivo" style={c.input} value={reason} onChangeText={setReason} placeholder={tr('Explica el motivo (mínimo 8 caracteres)')} placeholderTextColor="#b3c5d9"/>
      <Btn title={tr('Confirmar cambio en simulador')} disabled={busy} onPress={approve}/>
      <Btn title={tr('Actualizar indicadores')} disabled={busy} onPress={()=>refresh().catch(e=>setError(e.message))}/>
      <Text style={c.title}>{tr('Auditoría de política')}</Text>
      {(data.recentPolicyChanges||[]).length===0&&<Text style={c.text}>{tr('Sin cambios administrativos.')}</Text>}
      {(data.recentPolicyChanges||[]).map(e=><Text key={e.id} style={c.text}>{new Date(e.changedAt).toLocaleString()}: {e.reason} | {e.previousRate} → {e.newRate} STABLE/COIN | {e.previousActive?'activo':'pausa'} → {e.newActive?'activo':'pausa'}</Text>)}
    </>}
  </View>;
}
