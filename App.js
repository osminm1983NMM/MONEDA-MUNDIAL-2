// MONEDA MUNDIAL 2.0 — DEMOSTRACIÓN CON SUPABASE
// Los MWD son créditos ficticios. Esta aplicación NO mueve dinero real.
// Copia este archivo COMPLETO en App.js de un Snack NUEVO (conserva la versión 1.3).
// Dependencias de Snack: @supabase/supabase-js, @react-native-async-storage/async-storage,
// react-native-url-polyfill, react-native-get-random-values.

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import PartnerRegistryScreen from './PartnerRegistryScreen';
import CoinStableDemoScreen from './CoinStableDemoScreen';
import InternationalPlannerDemoScreen from './InternationalPlannerDemoScreen';
import DemoDiagnosticsScreen from './DemoDiagnosticsScreen';
import DemoAccountSelfcheckScreen from './DemoAccountSelfcheckScreen';
import DemoTwoAccountVerificationScreen from './DemoTwoAccountVerificationScreen';
import {HOME_DEMO_TEXT} from './src/digital-money/home-demo-i18n.mjs';
import {detectInternationalDemoLanguage} from './src/digital-money/international-demo-i18n.mjs';
import {INTERNATIONAL_DEMO_LANGUAGE_KEY,decodeInternationalDemoLanguagePreference,resolveInternationalDemoLanguage,saveInternationalDemoLanguagePreference} from './src/digital-money/international-demo-language-preference.mjs';
import DemoAssetSummaryCard from './DemoAssetSummaryCard';
import { createDemoSessionGuard, createDemoOperationGate } from './src/digital-money/demo-session-guard.mjs';
import { mwdPendingStorageKey, serializeMwdPending, deserializeMwdPending, buildMwdDemoRetry } from './src/digital-money/mwd-pending-operation-demo.mjs';
import {classifyMwdOperationStatus} from './src/digital-money/mwd-operation-status-demo.mjs';
import {reconcileMwdPendingDemo} from './src/digital-money/mwd-pending-recovery-demo.mjs';
import ConversionAdminDemoScreen from './ConversionAdminDemoScreen';
import PickupWithoutPhoneDemo from './PickupWithoutPhoneDemo';
import AgentAccessAdminDemo from './AgentAccessAdminDemo';

// CLAVE PUBLICABLE de Supabase. Nunca coloques claves secret/service_role en App.js.
const SUPABASE_URL = 'https://egrsdrlpavrtbgxoyxvg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sKotmweOAug6XqTR16U9Wg_ugxAx3vm';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const LIMIT_CENTS = 100000000; // 1 millón de MWD por operación ficticia
const formatMWD = cents => (Number(cents || 0) / 100).toFixed(2);

function amountToCents(value) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > LIMIT_CENTS) return null;
  return cents;
}

function uniqueRequestId() {
  if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
    throw new Error('No hay generador de identificadores seguros disponible.');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function message(title, body) {
  if (Platform.OS === 'web') window.alert(title + '\n' + body);
  else Alert.alert(title, body);
}

function confirmAction(title, detail, action) {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n' + detail)) action();
  } else {
    Alert.alert(title, detail, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: action },
    ]);
  }
}

function Btn({ title, onPress, secondary = false, disabled = false }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [deviceLanguage]=useState(detectInternationalDemoLanguage);
  const [languagePreference,setLanguagePreference]=useState('auto');
  const lang=resolveInternationalDemoLanguage(languagePreference,deviceLanguage);
  const homeText=HOME_DEMO_TEXT[lang];
  useEffect(()=>{
    let active=true;
    AsyncStorage.getItem(INTERNATIONAL_DEMO_LANGUAGE_KEY).then(value=>{
      if(active)setLanguagePreference(decodeInternationalDemoLanguagePreference(value));
    }).catch(()=>{});
    return ()=>{active=false;};
  },[]);
  async function chooseHomeLanguage(next){
    try { await saveInternationalDemoLanguagePreference(AsyncStorage,next);setLanguagePreference(next); }
    catch { message('Language / Idioma',homeText.languageError); }
  }
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [screen, setScreen] = useState('Inicio');
  const [wallet, setWallet] = useState(null);
  const [operations, setOperations] = useState([]);
  const [adminRole, setAdminRole] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const operationGateRef = useRef(null);
  if (!operationGateRef.current) operationGateRef.current=createDemoOperationGate();
  const pendingRef = useRef(null);
  const [mwdPending,setMwdPending]=useState(null);
  const [pendingReady,setPendingReady]=useState(false);
  const sessionGuardRef = useRef(null);
  if (!sessionGuardRef.current) sessionGuardRef.current=createDemoSessionGuard();
  const authEventsRef = useRef(0);
  const userId = session?.user?.id;

  function applySession(nextSession) {
    const changed=sessionGuardRef.current.setOwner(nextSession?.user?.id);
    if(changed) {
      // Una cuenta nunca ve por un instante el saldo/rol de la anterior.
      setWallet(null);setOperations([]);setAdminRole(null);setSyncing(false);
      operationGateRef.current.reset();setBusy(false);
      pendingRef.current=null;setMwdPending(null);setPendingReady(false);setAmount('');setRecipientCode('');
    }
    setSession(nextSession);
    setAuthLoading(false);
    if(changed)setScreen('Inicio');
  }

  useEffect(() => {
    let active = true;
    const beforeGetSession=authEventsRef.current;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        // Una respuesta inicial tardía no puede restaurar una sesión ya reemplazada.
        if (active && beforeGetSession===authEventsRef.current) applySession(data.session);
      })
      .catch(error => { if(active) message('Sesión', error.message); })
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEventsRef.current+=1;
      applySession(nextSession);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      return;
    }
    refreshAccount(userId);
  }, [userId]);

  useEffect(()=>{
    if(!userId)return;
    const ticket=sessionGuardRef.current.capture(userId);
    let active=true;
    const key=mwdPendingStorageKey(userId);
    (async()=>{
      const raw=key?await AsyncStorage.getItem(key):null;
      if(!active||!sessionGuardRef.current.sameSession(ticket))return;
      const restored=raw ? deserializeMwdPending(raw) : null;
      pendingRef.current=restored||(raw?{unavailable:true}:null);
      setMwdPending(pendingRef.current);
      setPendingReady(true);
    })().catch(()=>{
      if(active&&sessionGuardRef.current.sameSession(ticket)){
        pendingRef.current={unavailable:true};setMwdPending({unavailable:true});setPendingReady(true);
      }
    });
    return ()=>{active=false;};
  },[userId]);

  async function checkPendingMwd(allowSameReferenceRetry=false){
    const ticket=sessionGuardRef.current.capture(userId);
    const current=pendingRef.current;
    if(!ticket||!current||current.unavailable)return;
    const lock=operationGateRef.current.acquire();
    if(!lock)return;
    setBusy(true);
    try{
      const result=await reconcileMwdPendingDemo({
        request:current,
        rpc:(name,params)=>supabase.rpc(name,params),
        allowRetry:allowSameReferenceRetry,
        isCurrent:()=>sessionGuardRef.current.sameSession(ticket),
      });
      if(!sessionGuardRef.current.sameSession(ticket))return;
      if(result.state==='unconfirmed'){
        message('Estado no confirmado','El servidor todavía no registra el movimiento. Se conserva la referencia original para comprobarla de nuevo.');
        return;
      }
      const key=mwdPendingStorageKey(userId);
      if(!key)throw new Error('Cuenta inválida');
      await AsyncStorage.removeItem(key);
      if(!sessionGuardRef.current.sameSession(ticket))return;
      pendingRef.current=null;setMwdPending(null);
      message('Operación ficticia verificada','Esta referencia aparece procesada una sola vez. Sin dinero real.');
      await refreshAccount();
    }catch(e){
      if(sessionGuardRef.current.sameSession(ticket))
        message('Pendiente de verificar','Se conserva la referencia original. No inicies otro envío mientras se verifica el resultado.');
    }finally{
      if(operationGateRef.current.release(lock)&&sessionGuardRef.current.sameSession(ticket))setBusy(false);
    }
  }

  async function refreshAccount(id = userId) {
    const ticket=sessionGuardRef.current.begin(id);
    if(!ticket)return;
    setSyncing(true);
    // No conservar un saldo antiguo visible cuando la respuesta aún no se ha validado.
    setWallet(null);setOperations([]);setAdminRole(null);
    try {
      const [w, h, a] = await Promise.all([
        supabase.from('mwd_wallets')
          .select('user_id,account_code,balance_cents')
          .eq('user_id', id).single(),
        supabase.from('mwd_operations')
          .select('id,kind,source_user_id,destination_user_id,amount_cents,created_at')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('mwd_admin_roles').select('role').eq('user_id', id).maybeSingle(),
      ]);
      if(!sessionGuardRef.current.current(ticket))return;
      if(w.error)throw w.error;
      if(h.error)throw h.error;
      if(a.error)throw a.error;
      if(w.data?.user_id!==id)throw new Error('La billetera no corresponde a la sesión actual.');
      const history=h.data||[];
      if(history.some(op=>op.source_user_id!==id&&op.destination_user_id!==id))
        throw new Error('Se recibió un historial que no corresponde a esta cuenta.');
      setWallet(w.data);
      setOperations(history);
      setAdminRole(a.data?.role||null);
    } catch (error) {
      if(sessionGuardRef.current.current(ticket))
        message('Sincronización', error.message || 'No se pudo consultar Supabase.');
    } finally {
      if(sessionGuardRef.current.current(ticket))setSyncing(false);
    }
  }

  async function authenticate(action) {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return message('Correo', 'Introduce un correo válido.');
    if (password.length < 8) return message('Contraseña', 'Debe tener por lo menos 8 caracteres.');
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (action === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;
        message('Registro de prueba', data.session
          ? 'Cuenta creada. Iniciaste sesión correctamente.'
          : 'Revisa tu correo para confirmar el registro. Luego regresa e inicia sesión.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) {
      message('Acceso', error.message || 'No se pudo completar la operación.');
    } finally {
      setAuthBusy(false);
    }
  }

  function changeAmount(value) {
    setAmount(value);
    // No borrar una referencia de transferencia posiblemente procesada.
  }
  function changeRecipient(value) {
    setRecipientCode(value);
    // La referencia incierta solo desaparece tras conciliación verificable.
  }

  async function executeOperation(type, cents, code = '') {
    const sessionTicket=sessionGuardRef.current.capture(userId);
    if(!sessionTicket)return;
    const operationToken=operationGateRef.current.acquire();
    if(!operationToken)return;
    setBusy(true);
    try {
      if(!pendingReady||pendingRef.current||mwdPending)throw new Error('Primero verifica la operación pendiente.');
      // No bloquear la cuenta si AsyncStorage falla ANTES de guardar.
      // Si el archivo se guardó pero la sesión cambió, la referencia sigue
      // asociada al dueño original y se restaurará al iniciar sesión de nuevo.
      const requested={type,cents,code,id:uniqueRequestId()};
      const requestId=requested.id;
      const key=mwdPendingStorageKey(userId);
      const serialized=serializeMwdPending(requested);
      if(!key||!serialized)throw new Error('Referencia de prueba no válida');
      await AsyncStorage.setItem(key,serialized);
      if(!sessionGuardRef.current.sameSession(sessionTicket))return;
      pendingRef.current=requested;
      setMwdPending(requested);
      const response = type === 'transfer'
        ? await supabase.rpc('mwd_transfer_demo', {
          p_recipient_code: code, p_amount_cents: cents, p_request_id: requestId,
        })
        : await supabase.rpc('mwd_contribute_demo', {
          p_amount_cents: cents, p_request_id: requestId,
        });
      if (!sessionGuardRef.current.sameSession(sessionTicket)) return;
      if (response.error) throw response.error;
      if (!['ok', 'already_processed'].includes(response.data?.status)) {
        throw new Error('Respuesta de operación sin confirmación verificable.');
      }
      // Consultar en lectura el registro del servidor ANTES de borrar la referencia.
      // Tras perder la red, la operación pudo completarse: jamás volver a enviarla
      // con otra referencia para "resolver" la incertidumbre.
      const checked=await supabase.rpc('mwd_operation_status_demo',{p_request_id:requestId});
      if(!sessionGuardRef.current.sameSession(sessionTicket))return;
      if(checked.error)throw checked.error;
      if(classifyMwdOperationStatus(checked.data,pendingRef.current)!=='processed'){
        throw new Error('La operación requiere conciliación. No intentes otro envío.');
      }
      if(response.data.operation_id!==checked.data.operationId){
        throw new Error('El recibo de la operación no coincide con el registro de Supabase.');
      }
      await AsyncStorage.removeItem(key);
      if(!sessionGuardRef.current.sameSession(sessionTicket))return;
      pendingRef.current = null;setMwdPending(null);
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      // La confirmación es definitiva aunque falle una actualización de pantalla.
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
      await refreshAccount();
    } catch (error) {
      if(sessionGuardRef.current.sameSession(sessionTicket)) {
        message('Operación pendiente de verificación',
          (error.message || 'No fue posible verificar el estado.') +
          (pendingRef.current
            ? '\nNo realices otro envío: usa «Verificar operación MWD anterior» en Inicio.'
            : '\nNo se inició ningún envío. Puedes intentarlo nuevamente.'));
      }
    } finally {
      if(operationGateRef.current.release(operationToken) && sessionGuardRef.current.sameSession(sessionTicket))setBusy(false);
    }
  }

  function prepareOperation(type) {
    if (operationGateRef.current.isBusy()) return;
    if(!pendingReady||pendingRef.current||mwdPending)return message('Operación pendiente','Revisa la operación anterior antes de iniciar una nueva.');
    const cents = amountToCents(amount);
    if (cents === null) {
      return message('Cantidad inválida', 'Introduce un importe positivo, máximo 1,000,000 MWD y dos decimales.');
    }
    if (!wallet) return message('Espera', 'Primero carga tu cuenta.');
    if (cents > wallet.balance_cents) return message('Saldo insuficiente', 'No tienes suficientes MWD ficticios.');
    const code = recipientCode.trim().toUpperCase();
    if (type === 'transfer') {
      if (!/^MWD-[A-F0-9]{16}$/.test(code)) {
        return message('Identificador', 'Introduce el código MWD- seguido de 16 caracteres.');
      }
      if (code === wallet.account_code) return message('Destinatario', 'No puedes enviarte MWD a tu propia cuenta.');
    }
    confirmAction(type === 'transfer' ? 'Transferencia de prueba' : 'Aportación de prueba',
      `${formatMWD(cents)} MWD ficticios${type === 'transfer' ? '\nDestino: ' + code : '\nFondo de demostración'}`,
      () => executeOperation(type, cents, code));
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) message('Salida', error.message);
  }

  function navigate(to) {
    setScreen(to);
    setAmount('');
    setRecipientCode('');
    // No borrar referencias inciertas al navegar.
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07111f" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🌐 MONEDA MUNDIAL</Text>
        <Text style={styles.sub}>{homeText.subtitle}</Text>
        <Text style={styles.warning}>{homeText.warning}</Text>
        <View style={{flexDirection:'row',justifyContent:'center',flexWrap:'wrap',marginBottom:9}}>
          {['auto','es','en'].map(x=><TouchableOpacity key={x} accessibilityRole="button" onPress={()=>chooseHomeLanguage(x)}
            style={[styles.buttonSecondary,{padding:9,borderRadius:8,marginHorizontal:4,marginBottom:4},languagePreference===x&&{borderWidth:1,borderColor:'#f4cc81'}]}>
            <Text style={styles.buttonText}>{x==='auto'?'Auto':x==='es'?'Español':'English'}</Text>
          </TouchableOpacity>)}
        </View>

        {authLoading ? <ActivityIndicator color="#4a8dff" size="large" /> : !session ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{homeText.loginHeading}</Text>
            <Text style={styles.muted}>{homeText.loginHelp}</Text>
            <TextInput style={styles.input} placeholder={homeText.email}
              placeholderTextColor="#9fb1c8" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder={homeText.password}
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={password} onChangeText={setPassword} />
            <Btn title={authBusy ? homeText.wait : homeText.signIn} onPress={() => authenticate('login')} disabled={authBusy} />
            <Btn title={homeText.signUp} secondary onPress={() => authenticate('register')} disabled={authBusy} />
            <Text style={styles.muted}>{homeText.signupHelp}</Text>
          </View>
        ) : (
          <>
            {screen !== 'Inicio' && <Btn title={homeText.back} secondary onPress={() => navigate('Inicio')} disabled={busy} />}
            {screen === 'Inicio' && <>
              <View style={styles.card}>
                <Text style={styles.muted}>{homeText.account}</Text>
                <Text style={styles.small}>{session.user.email}</Text>
                <Text style={styles.balance}>{wallet ? formatMWD(wallet.balance_cents) : '...'} MWD</Text>
                <Text style={styles.muted}>{homeText.balance}</Text>
                <Text selectable style={styles.code}>{wallet?.account_code || 'Cargando identificador...'}</Text>
              </View>
              {!!mwdPending&&<Text style={styles.warning}>{homeText.pending}</Text>}
              {!!mwdPending&&!mwdPending.unavailable&&<Text selectable style={styles.muted}>Referencia: {mwdPending.id}{'\n'}{homeText.kind}: {mwdPending.type==='transfer'?homeText.transfer:homeText.contribution} · {formatMWD(mwdPending.cents)} MWD de prueba{mwdPending.type==='transfer'?' · '+homeText.recipient+': '+mwdPending.code:''}</Text>}
              {!!mwdPending&&!mwdPending.unavailable&&<Btn title={homeText.checkPending} onPress={()=>checkPendingMwd(false)} disabled={busy} />}
              {!!mwdPending&&!mwdPending.unavailable&&<Btn title={homeText.retryPending} secondary disabled={busy} onPress={()=>
                confirmAction('Reintento idempotente de DEMO',
                  'Se consultará primero el registro. Solo si no está confirmada se repetirá exactamente la misma referencia, cantidad y beneficiario. Nunca utiliza dinero real.',
                  ()=>checkPendingMwd(true))
              } />}
              <Btn title={homeText.transferButton} onPress={() => navigate('Transferir')} disabled={!wallet} />
              <Btn title={homeText.internationalButton} secondary onPress={() => navigate('Internacional')} />
              <Btn title={homeText.contributionButton} onPress={() => navigate('Aportar')} disabled={!wallet} />
              <Btn title={homeText.historyButton} secondary onPress={() => navigate('Historial')} />
              <Btn title={homeText.receiveButton} secondary onPress={() => navigate('Cuenta')} />
              <Btn title={homeText.selfcheckButton} secondary onPress={() => navigate('Seguridad')} />
              <Btn title={lang==='en'?'A / B Coin-Digital check (DEMO)':'Prueba dos cuentas Coin/Digital (DEMO)'} secondary onPress={() => navigate('Prueba A/B')} />
              <Btn title={homeText.refreshButton} secondary onPress={() => refreshAccount()} disabled={syncing} />
              <DemoAssetSummaryCard key={userId} userId={userId} supabase={supabase} onOpenConversion={() => navigate('Conversión')} />
              <Btn title={homeText.cashPickupButton} secondary onPress={() => navigate('Entrega')} />
              <Btn title={homeText.adminButton} secondary onPress={() => navigate('Admin')} />
              <Btn title={homeText.logoutButton} secondary onPress={logout} />
            </>}

            {screen === 'Transferir' && <View style={styles.card}>
              <Text style={styles.heading}>{homeText.transferTitle}</Text>
              <Text style={styles.muted}>{homeText.transferHelp}</Text>
              <TextInput style={styles.input} placeholder={homeText.recipientPlaceholder}
                autoCapitalize="characters" autoCorrect={false} placeholderTextColor="#9fb1c8"
                value={recipientCode} onChangeText={changeRecipient} />
              <TextInput style={styles.input} placeholder={homeText.amountPlaceholder} keyboardType="decimal-pad"
                placeholderTextColor="#9fb1c8" value={amount} onChangeText={changeAmount} />
              <Btn title={busy ? homeText.processing : homeText.confirmTransfer}
                onPress={() => prepareOperation('transfer')} disabled={busy} />
            </View>}

            {screen === 'Aportar' && <View style={styles.card}>
              <Text style={styles.heading}>{homeText.contributionTitle}</Text>
              <Text style={styles.muted}>{homeText.contributionHelp}</Text>
              <TextInput style={styles.input} placeholder={homeText.amountPlaceholder} keyboardType="decimal-pad"
                placeholderTextColor="#9fb1c8" value={amount} onChangeText={changeAmount} />
              <Btn title={busy ? homeText.processing : homeText.confirmContribution}
                onPress={() => prepareOperation('contribution')} disabled={busy} />
            </View>}

            {screen === 'Cuenta' && <View style={styles.card}>
              <Text style={styles.heading}>{homeText.receiveTitle}</Text>
              <Text selectable style={styles.code}>{wallet?.account_code}</Text>
              <Text style={styles.muted}>{homeText.receiveHelp}</Text>
              <Text style={styles.small}>Correo: {session.user.email}</Text>
            </View>}

            {screen === 'Historial' && <>
              <Text style={styles.heading}>{homeText.historyTitle}</Text>
              {operations.length === 0 && <Text style={styles.muted}>{homeText.noHistory}</Text>}
              {operations.map(op => {
                const sent = op.kind === 'contribution' || op.source_user_id === userId;
                const label = op.kind === 'contribution' ? homeText.contributionHistory :
                  sent ? homeText.sent : homeText.received;
                return (
                  <View style={styles.entry} key={op.id}>
                    <Text style={styles.itemHeading}>{label}</Text>
                    <Text style={styles.amount}>{sent ? '-' : '+'}{formatMWD(op.amount_cents)} MWD</Text>
                    <Text style={styles.muted}>{new Date(op.created_at).toLocaleString()}</Text>
                  </View>
                );
              })}
            </>}

            {screen === 'Prueba A/B' && <DemoTwoAccountVerificationScreen key={userId} userId={userId} supabase={supabase} sessionGuard={sessionGuardRef.current} language={lang} />}
            {screen === 'Seguridad' && <DemoAccountSelfcheckScreen key={userId} supabase={supabase} userId={userId} sessionGuard={sessionGuardRef.current} labels={homeText} />}
            {screen === 'Internacional' && <InternationalPlannerDemoScreen languagePreference={languagePreference} onLanguageChange={chooseHomeLanguage} />}
            {screen === 'Conversión' && <CoinStableDemoScreen key={userId} userId={userId} supabase={supabase} />}
            {screen === 'Entrega' && <PickupWithoutPhoneDemo supabase={supabase} isOwner={adminRole === 'owner'} />}
            {screen === 'Admin' && <View style={styles.card}>
              <Text style={styles.heading}>Administración MWD</Text>
              {adminRole === 'owner' ? (
                <><PartnerRegistryScreen supabase={supabase} /><ConversionAdminDemoScreen supabase={supabase} /><AgentAccessAdminDemo supabase={supabase} /></>
              ) : adminRole ? (
                <Text style={styles.muted}>Tu rol es: {adminRole}. El registro de socios requiere permisos de propietario.</Text>
              ) : (
                <Text style={styles.muted}>Esta cuenta no tiene permisos administrativos. Solo el propietario del proyecto podrá asignarlos desde un entorno seguro.</Text>
              )}
              <Text style={styles.warning}>Nunca se puede asignar el rol de administrador desde esta pantalla.</Text>
            </View>}
          </>
        )}
        <Btn title={lang==='en'?'View build info (DEMO)':'Ver información de versión (DEMO)'} secondary onPress={()=>navigate('Diagnóstico')} />
        {screen === 'Diagnóstico' && <DemoDiagnosticsScreen language={lang} />}
        <Text style={styles.footer}>{homeText.footer}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111f' },
  body: { padding: 22, paddingTop: 40, paddingBottom: 60 },
  logo: { color: '#ffffff', fontSize: 25, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#9ab0cf', textAlign: 'center', marginTop: 6 },
  warning: { color: '#f4cc81', textAlign: 'center', marginVertical: 19, fontSize: 12 },
  card: { backgroundColor: '#13253e', borderRadius: 17, padding: 20, marginBottom: 17 },
  heading: { color: '#fff', fontSize: 21, fontWeight: '700', marginBottom: 13 },
  muted: { color: '#9ab0cf', lineHeight: 21, marginBottom: 9 },
  small: { color: '#d4e0f1', marginTop: 6 },
  balance: { color: '#fff', fontSize: 31, fontWeight: '800', marginVertical: 17 },
  code: { color: '#8fc1ff', fontSize: 16, marginTop: 12, fontWeight: '700' },
  input: { backgroundColor: '#233a58', color: '#fff', padding: 14, borderRadius: 11, marginVertical: 8, fontSize: 16 },
  button: { backgroundColor: '#276af1', padding: 16, borderRadius: 11, marginBottom: 12, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#334b68' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  entry: { backgroundColor: '#14263e', padding: 17, borderRadius: 13, marginBottom: 12 },
  itemHeading: { color: '#fff', fontSize: 16, fontWeight: '600' },
  amount: { color: '#fff', fontSize: 18, marginVertical: 8 },
  footer: { color: '#7e92a8', textAlign: 'center', fontSize: 11, marginTop: 30 },
});
