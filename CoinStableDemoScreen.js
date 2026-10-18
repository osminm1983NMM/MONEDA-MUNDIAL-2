// Conversor aislado de activos ficticios: NO ES UN EXCHANGE ni stablecoin real.
import 'react-native-get-random-values';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import {parseDemoAssetBalances,formatDemoMicro} from './src/digital-money/demo-asset-summary.mjs';
import {validateDemoQuote,validateDemoReceipt,validateDemoHistory} from './src/digital-money/demo-conversion-contract.mjs';

const MICRO = 1000000;
const MAX = 10000;
const s = {
  card:{backgroundColor:'#13253e',padding:15,borderRadius:12,marginTop:12},
  title:{color:'#fff',fontSize:20,fontWeight:'800',marginBottom:8},
  text:{color:'#d4e0f1',marginBottom:9,lineHeight:21},
  warning:{color:'#ffdb91',marginBottom:13,lineHeight:20},
  input:{backgroundColor:'#233a58',color:'#fff',padding:14,borderRadius:9,marginBottom:12},
  button:{backgroundColor:'#276af1',padding:13,borderRadius:9,marginBottom:9},
  buttonText:{color:'#fff',textAlign:'center',fontWeight:'700'},
  item:{paddingVertical:9,borderTopWidth:1,borderColor:'#43516b'},
};
const fmt = formatDemoMicro;
function toMicro(input) {
  const v=input.trim().replace(',','.');
  if (!/^\d+(\.\d{1,6})?$/.test(v)) return null;
  const [units,dec='']=v.split('.');
  const n=Number(units)*MICRO+Number(dec.padEnd(6,'0'));
  return Number.isSafeInteger(n) && n>=MICRO && n<=MAX*MICRO ? n : null;
}
function uuid() {
  if(!globalThis.crypto?.getRandomValues) throw new Error('Identificador seguro no disponible');
  const bytes=new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
function Btn({label,onPress,disabled=false}) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled}
    style={[s.button,disabled&&{opacity:0.5}]} onPress={onPress}>
    <Text style={s.buttonText}>{label}</Text>
  </TouchableOpacity>;
}
export default function CoinStableDemoScreen({supabase}) {
  const [wallet,setWallet]=useState(null);
  const [walletState,setWalletState]=useState('loading');
  const [asset,setAsset]=useState('COIN');
  const [amount,setAmount]=useState('1');
  const [quote,setQuote]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [now,setNow]=useState(Date.now());
  const requestVersion=useRef(0);
  const walletRequest=useRef(0);
  const mounted=useRef(false);
  const pendingAction=useRef(false); // Candado inmediato contra dobles toques.
  const activeQuote=useRef(null); // No confirmar un aviso de una cotización ya cambiada.
  const load=useCallback(async()=>{
    const ticket=++walletRequest.current;
    if(mounted.current){
      setWallet(null); // Nunca dejar visible un saldo de una solicitud anterior.
      setWalletState('loading');
      setError('');
    }
    try {
      const {data,error:e}=await supabase.rpc('mwd_conversion_wallet_demo');
      if(e)throw e;
      const parsed=parseDemoAssetBalances(data);
      const history=validateDemoHistory(data?.history);
      if(!parsed||!history)throw new Error('Saldos o historial ficticios no verificables.');
      if(mounted.current&&ticket===walletRequest.current){
        setWallet({...parsed,history});
        setWalletState('ready');
      }
    }catch(e){
      if(mounted.current&&ticket===walletRequest.current){
        setWallet(null);
        setWalletState('error');
        setError('No se pudo actualizar el saldo de prueba. Inténtalo de nuevo.');
      }
      throw e;
    }
  },[supabase]);
  useEffect(()=>{
    mounted.current=true;
    load().catch(()=>{});
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>{
      mounted.current=false;
      walletRequest.current+=1; // Ignorar respuestas de sesiones/pantallas anteriores.
      clearInterval(timer);
    };
  },[load]);
  function reset() {requestVersion.current+=1;activeQuote.current=null;setQuote(null);setError('');setNotice('');}
  async function requestQuote() {
    if(busy||pendingAction.current)return;
    reset();
    const ticket=requestVersion.current;
    const cents=toMicro(amount);
    if(cents===null){setError('Escribe una cantidad de 1 a 10,000 con hasta seis decimales.');return;}
    pendingAction.current=true;
    setBusy(true);
    try {
      const {data,error:e}=await supabase.rpc('mwd_conversion_quote_demo',{
        p_from_asset:asset,p_amount_micro:cents,p_client_request_id:uuid()
      });
      if(e)throw e;
      const checked=validateDemoQuote(data,asset,cents);
      if(!checked)throw new Error('Cotización de demostración inválida o vencida.');
      if(mounted.current&&requestVersion.current===ticket){activeQuote.current=checked;setQuote(checked);}
    } catch(e){if(requestVersion.current===ticket)setError(e.message||'No se pudo obtener cotización');}
    finally{pendingAction.current=false;if(mounted.current)setBusy(false);}
  }
  async function confirm() {
    const current=activeQuote.current;
    if(!current||busy||pendingAction.current||Date.parse(current.expiresAt)<=Date.now())return;
    pendingAction.current=true;
    setBusy(true);setError('');
    try {
      const {data,error:e}=await supabase.rpc('mwd_conversion_confirm_demo',{p_quote_id:current.quoteId});
      if(e)throw e;
      if(!validateDemoReceipt(data,current))throw new Error('No se pudo verificar el recibo ficticio.');
      activeQuote.current=null;
      setQuote(null);
      setNotice('Conversión ficticia confirmada en el servidor de pruebas. Sin dinero real.');
      try{await load();}
      catch{setError('La conversión ficticia fue confirmada, pero no se pudo actualizar el saldo. Usa Actualizar saldos e historial.');}
    } catch(e){setError(e.message||'Conversión no confirmada');}
    finally{pendingAction.current=false;if(mounted.current)setBusy(false);}
  }
  const expired=quote&&Date.parse(quote.expiresAt)<=now;
  return <View style={s.card}>
    <Text style={s.title}>Coin ↔ Estable</Text>
    <Text style={s.warning}>SOLO SIMULACIÓN. Precio sintético, sin cotización de mercado, reservas ni retiros. Los saldos no son dinero y no se mezclan con MWD.</Text>
    <Text style={s.text}>Coin ficticia: {wallet?fmt(wallet.coinMicro):walletState==='loading'?'Cargando...':'No disponible'} {wallet?'COIN':''}</Text>
    <Text style={s.text}>Digital ficticia: {wallet?fmt(wallet.stableMicro):walletState==='loading'?'Cargando...':'No disponible'} {wallet?'STABLE':''}</Text>
    <Btn label={asset==='COIN'?'Origen: COIN → STABLE':'Origen: STABLE → COIN'}
      disabled={busy} onPress={()=>{setAsset(a=>a==='COIN'?'STABLE':'COIN');reset();}} />
    <TextInput accessibilityLabel="Cantidad ficticia" style={s.input}
      placeholder="Importe de prueba" placeholderTextColor="#b3c5d9"
      keyboardType="decimal-pad" editable={!busy} value={amount}
      onChangeText={v=>{setAmount(v);reset();}} />
    <Btn label={busy?'Procesando...':'Obtener cotización de prueba'}
      disabled={busy} onPress={requestQuote}/>
    {!!quote&&<View style={s.item}>
      <Text style={s.text}>{fmt(quote.amountInMicro)} {quote.fromAsset} → {fmt(quote.amountOutMicro)} {quote.toAsset}</Text>
      <Text style={s.text}>Comisión simulada: {fmt(quote.feeOutMicro)} {quote.toAsset}</Text>
      <Text style={s.text}>Precio sintético: 1 COIN = {quote.stablePerCoin} STABLE</Text>
      <Text style={s.warning}>{expired?'Cotización vencida. Solicita otra.':'Válida durante 90 segundos desde su emisión.'}</Text>
      <Btn label="Confirmar conversión FICTICIA" disabled={busy||!!expired||quote.status==='executed'} onPress={()=>{
        Alert.alert('Solo demostración','No representa dinero ni monedas negociables.',[
          {text:'Cancelar',style:'cancel'},{text:'Confirmar prueba',onPress:confirm}
        ]);
      }}/>
    </View>}
    {!!error&&<Text style={s.warning}>{error}</Text>}
    {!!notice&&<Text style={s.text}>{notice}</Text>}
    <Btn label="Actualizar saldos e historial" disabled={busy} onPress={()=>load().catch(e=>setError(e.message))}/>
    <Text style={s.title}>Últimas conversiones ficticias</Text>
    {walletState==='error'&&<Text style={s.warning}>Historial temporalmente no disponible.</Text>}
    {walletState==='ready'&&wallet?.history?.length===0&&<Text style={s.text}>Sin conversiones registradas.</Text>}
    {(wallet?.history||[]).map(op=><View key={op.id} style={s.item}>
      <Text style={s.text}>{fmt(op.amountInMicro)} {op.fromAsset} → {fmt(op.amountOutMicro)} {op.toAsset}</Text>
      <Text style={s.text}>Comisión ficticia: {fmt(op.feeOutMicro)} {op.toAsset} · Precio simulado: {op.priceSnapshot}</Text>
      <Text selectable style={s.text}>Referencia de prueba: {op.id}</Text>
      <Text style={s.text}>{new Date(op.settledAt).toLocaleString()}</Text>
    </View>)}
  </View>;
}
