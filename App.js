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
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingStorageError, setPendingStorageError] = useState(false);
  const [pendingUnconfirmed, setPendingUnconfirmed] = useState(false);
  const userId = session?.user?.id;
  const activeUserRef = useRef(null);
  activeUserRef.current = userId;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setSession(data.session);
      })
      .catch(error => message('Sesión', error.message))
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
      setScreen('Inicio');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    pendingRef.current = null;
    setPendingOperation(null);
    setPendingLoading(true);
    setPendingStorageError(false);
    setPendingUnconfirmed(false);
    if (!userId) {
      setPendingLoading(false);
      return () => { active = false; };
    }
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`mwd_pending_${userId}`);
        if (active && raw) {
          const item = JSON.parse(raw);
          if (typeof item?.id === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) &&
              item.userId === userId &&
              ['transfer', 'contribution'].includes(item.type) &&
              Number.isSafeInteger(item.cents) && item.cents >= 1 && item.cents <= LIMIT_CENTS &&
              (item.type === 'contribution' ||
                (typeof item.code === 'string' && /^MWD-[A-F0-9]{16}$/.test(item.code)))) {
            pendingRef.current = item;
            setPendingOperation(item);
          } else {
            throw new Error('Referencia pendiente inválida');
          }
        }
      } catch (error) {
        if (active) {
          setPendingStorageError(true);
          message('Recuperación', 'No se pudo leer la operación pendiente. Se bloquearon nuevas operaciones por seguridad.');
        }
      } finally {
        if (active) setPendingLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      return;
    }
    refreshAccount(userId);
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!id) return;
    setSyncing(true);
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
      if (w.error) throw w.error;
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      if (activeUserRef.current !== id) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
    } catch (error) {
      message('Sincronización', error.message || 'No se pudo consultar Supabase.');
    } finally {
      setSyncing(false);
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
  }
  function changeRecipient(value) {
    setRecipientCode(value);
  }

  async function recoverPending() {
    const item = pendingRef.current || pendingOperation;
    if (!item || !userId || item.userId !== userId || recovering || busyRef.current || pendingLoading || pendingStorageError) return;
    setPendingUnconfirmed(false);
    setRecovering(true);
    try {
      const { data, error } = await supabase.rpc('mwd_operation_status_demo', { p_request_id: item.id });
      if (error) throw error;
      if (activeUserRef.current !== item.userId) return;
      if (data?.status === 'processed') {
        await AsyncStorage.removeItem(`mwd_pending_${userId}`);
        if (activeUserRef.current !== item.userId) return;
        pendingRef.current = null;
        setPendingOperation(null);
        setPendingUnconfirmed(false);
        await refreshAccount(userId);
        message('Operación confirmada', 'Supabase confirmó que esta operación ficticia ya fue procesada.');
      } else if (data?.status === 'unconfirmed') {
        setPendingUnconfirmed(true);
        message('Operación sin confirmar', 'No aparece procesada. Conservamos su referencia. No se ha realizado un segundo envío.');
      } else {
        throw new Error('Estado desconocido. Conservamos la referencia para revisión.');
      }
    } catch (error) {
      message('Verificación pendiente', error.message || 'No se pudo consultar el estado.');
    } finally {
      setRecovering(false);
    }
  }

  async function retryPending() {
    const item = pendingRef.current || pendingOperation;
    if (!pendingUnconfirmed || !item || item.userId !== userId ||
        pendingLoading || pendingStorageError || recovering || busyRef.current) return;
    confirmAction('Reintento protegido',
      'Se enviará la MISMA solicitud ficticia con el MISMO identificador. Supabase debe impedir el doble descuento.',
      async () => {
        if (busyRef.current || activeUserRef.current !== item.userId ||
            !pendingRef.current || pendingRef.current.id !== item.id) return;
        busyRef.current = true;
        setBusy(true);
        setPendingUnconfirmed(false);
        try {
          const response = item.type === 'transfer'
            ? await supabase.rpc('mwd_transfer_demo', {
                p_recipient_code: item.code, p_amount_cents: item.cents, p_request_id: item.id,
              })
            : await supabase.rpc('mwd_contribute_demo', {
                p_amount_cents: item.cents, p_request_id: item.id,
              });
          if (response.error) throw response.error;
          if (activeUserRef.current !== item.userId) return;
          if (!['ok', 'already_processed'].includes(response.data?.status)) {
            throw new Error('Supabase no confirmó el resultado.');
          }
          await AsyncStorage.removeItem(`mwd_pending_${item.userId}`);
          if (activeUserRef.current !== item.userId) return;
          pendingRef.current = null;
          setPendingOperation(null);
          await refreshAccount(item.userId);
          message('Operación confirmada', 'La solicitud ficticia fue registrada sin generar un identificador nuevo.');
        } catch (error) {
          message('Reintento sin confirmar', (error.message || 'Error desconocido') +
            '\nConservamos la referencia. Consulta nuevamente el estado antes de reintentar.');
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      });
  }

  async function executeOperation(type, cents, code = '') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!userId || pendingLoading || pendingStorageError || pendingRef.current || pendingOperation) {
        throw new Error('Existe una operación pendiente o una verificación incompleta. Revisa su estado antes de continuar.');
      }
      const item = { type, cents, code, id: uniqueRequestId(), userId };
      // Persistir ANTES de enviar la solicitud; si falla el almacenamiento, no enviarla.
      await AsyncStorage.setItem(`mwd_pending_${userId}`, JSON.stringify(item));
      // Mantener el bloqueo incluso si cambia la sesión mientras se guarda la referencia.
      if (activeUserRef.current !== item.userId) return;
      pendingRef.current = item;
      setPendingOperation(item);
      const requestId = item.id;
      const response = type === 'transfer'
        ? await supabase.rpc('mwd_transfer_demo', {
          p_recipient_code: code, p_amount_cents: cents, p_request_id: requestId,
        })
        : await supabase.rpc('mwd_contribute_demo', {
          p_amount_cents: cents, p_request_id: requestId,
        });
      if (response.error) throw response.error;
      if (activeUserRef.current !== item.userId) return;
      if (!['ok', 'already_processed'].includes(response.data?.status)) {
        throw new Error('La operación no pudo ser confirmada.');
      }
      await AsyncStorage.removeItem(`mwd_pending_${userId}`);
      if (activeUserRef.current !== item.userId) return;
      pendingRef.current = null;
      setPendingOperation(null);
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      await refreshAccount();
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
    } catch (error) {
      // Si el almacenamiento falló antes de crear la referencia, no se envió la RPC.
      // Si falló después, conservar el bloqueo y consultar el estado antes de reintentar.
      if (pendingRef.current?.userId === userId) {
        setPendingOperation(pendingRef.current);
      }
      message('Operación no confirmada',
        (error.message || 'Error desconocido') + '\nNo inicies otra operación. Verifica primero el estado pendiente desde Inicio.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function prepareOperation(type) {
    if (busyRef.current || recovering) return;
    if (pendingLoading || pendingStorageError || pendingRef.current || pendingOperation) return message('Operación pendiente', 'Primero debemos verificar que no haya una operación anterior sin resolver.');
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
    // No borrar referencias persistidas al navegar.
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07111f" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🌐 MONEDA MUNDIAL</Text>
        <Text style={styles.sub}>MWD • Versión 2.0 • Supabase</Text>
        <Text style={styles.warning}>SOLO DEMOSTRACIÓN • SIN DINERO REAL</Text>

        {authLoading ? <ActivityIndicator color="#4a8dff" size="large" /> : !session ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Accede a Moneda Mundial</Text>
            <Text style={styles.muted}>Crea una cuenta de prueba o inicia sesión.</Text>
            <TextInput style={styles.input} placeholder="Correo electrónico"
              placeholderTextColor="#9fb1c8" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Contraseña (8 caracteres mínimo)"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={password} onChangeText={setPassword} />
            <Btn title={authBusy ? 'Espera...' : 'Iniciar sesión'} onPress={() => authenticate('login')} disabled={authBusy} />
            <Btn title="Crear cuenta de prueba" secondary onPress={() => authenticate('register')} disabled={authBusy} />
            <Text style={styles.muted}>Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.</Text>
          </View>
        ) : (
          <>
            {screen !== 'Inicio' && <Btn title="← Volver al inicio" secondary onPress={() => navigate('Inicio')} disabled={busy} />}
            {screen === 'Inicio' && <>
              <View style={styles.card}>
                <Text style={styles.muted}>TU CUENTA PERSONAL DE PRUEBA</Text>
                <Text style={styles.small}>{session.user.email}</Text>
                <Text style={styles.balance}>{wallet ? formatMWD(wallet.balance_cents) : '...'} MWD</Text>
                <Text style={styles.muted}>Saldo ficticio en Supabase</Text>
                <Text selectable style={styles.code}>{wallet?.account_code || 'Cargando identificador...'}</Text>
              </View>
              {pendingStorageError && <Text style={styles.warning}>No se pudo verificar el almacenamiento local. Las operaciones están bloqueadas hasta resolverlo.</Text>}
              {pendingLoading && <Text style={styles.muted}>Verificando operaciones pendientes...</Text>}
              {pendingOperation && <View style={styles.card}>
                <Text style={styles.heading}>Operación pendiente de verificación</Text>
                <Text style={styles.muted}>No inicies otra operación hasta comprobar el resultado en Supabase.</Text>
                <Btn title={recovering ? 'Consultando...' : 'Verificar operación pendiente'} onPress={recoverPending} disabled={recovering || busy} />
                {pendingUnconfirmed && <Btn title="Reintentar misma solicitud" secondary onPress={retryPending} disabled={busy || recovering} />}
              </View>}
              <Btn title="Transferir MWD entre usuarios" onPress={() => navigate('Transferir')} disabled={!wallet || !!pendingOperation || pendingLoading || pendingStorageError || recovering} />
              <Btn title="Registrar aportación ficticia" onPress={() => navigate('Aportar')} disabled={!wallet || !!pendingOperation || pendingLoading || pendingStorageError || recovering || busy} />
              <Btn title="Mis movimientos" secondary onPress={() => navigate('Historial')} />
              <Btn title="Mi cuenta / recibir" secondary onPress={() => navigate('Cuenta')} />
              <Btn title="Actualizar saldo e historial" secondary onPress={() => refreshAccount()} disabled={syncing} />
              <Btn title="Administración" secondary onPress={() => navigate('Admin')} />
              <Btn title="Cerrar sesión" secondary onPress={logout} />
            </>}

            {screen === 'Transferir' && <View style={styles.card}>
              <Text style={styles.heading}>Transferencia de prueba</Text>
              <Text style={styles.muted}>Pide a la otra persona su código MWD para enviarle créditos de demostración.</Text>
              <TextInput style={styles.input} placeholder="Ejemplo: MWD-0123456789ABCDEF"
                autoCapitalize="characters" autoCorrect={false} placeholderTextColor="#9fb1c8"
                value={recipientCode} onChangeText={changeRecipient} />
              <TextInput style={styles.input} placeholder="Cantidad MWD" keyboardType="decimal-pad"
                placeholderTextColor="#9fb1c8" value={amount} onChangeText={changeAmount} />
              <Btn title={busy ? 'Procesando...' : 'Confirmar transferencia ficticia'}
                onPress={() => prepareOperation('transfer')} disabled={busy} />
            </View>}

            {screen === 'Aportar' && <View style={styles.card}>
              <Text style={styles.heading}>Aportación de prueba</Text>
              <Text style={styles.muted}>La cantidad se descontará de tu saldo ficticio y quedará en el historial. No se recibirá dinero real.</Text>
              <TextInput style={styles.input} placeholder="Cantidad MWD" keyboardType="decimal-pad"
                placeholderTextColor="#9fb1c8" value={amount} onChangeText={changeAmount} />
              <Btn title={busy ? 'Procesando...' : 'Confirmar aportación ficticia'}
                onPress={() => prepareOperation('contribution')} disabled={busy} />
            </View>}

            {screen === 'Cuenta' && <View style={styles.card}>
              <Text style={styles.heading}>Mi identificador para recibir</Text>
              <Text selectable style={styles.code}>{wallet?.account_code}</Text>
              <Text style={styles.muted}>Comparte este identificador con otra cuenta de prueba. No compartas tu contraseña.</Text>
              <Text style={styles.small}>Correo: {session.user.email}</Text>
            </View>}

            {screen === 'Historial' && <>
              <Text style={styles.heading}>Mis últimos movimientos</Text>
              {operations.length === 0 && <Text style={styles.muted}>Todavía no hay movimientos en línea.</Text>}
              {operations.map(op => {
                const sent = op.kind === 'contribution' || op.source_user_id === userId;
                const label = op.kind === 'contribution' ? 'Aportación ficticia' :
                  sent ? 'Transferencia enviada' : 'Transferencia recibida';
                return (
                  <View style={styles.entry} key={op.id}>
                    <Text style={styles.itemHeading}>{label}</Text>
                    <Text style={styles.amount}>{sent ? '-' : '+'}{formatMWD(op.amount_cents)} MWD</Text>
                    <Text style={styles.muted}>{new Date(op.created_at).toLocaleString()}</Text>
                  </View>
                );
              })}
            </>}

            {screen === 'Admin' && <View style={styles.card}>
              <Text style={styles.heading}>Administración MWD</Text>
              {adminRole === 'owner' ? (
                <PartnerRegistryScreen supabase={supabase} />
              ) : adminRole ? (
                <Text style={styles.muted}>Tu rol es: {adminRole}. El registro de socios requiere permisos de propietario.</Text>
              ) : (
                <Text style={styles.muted}>Esta cuenta no tiene permisos administrativos. Solo el propietario del proyecto podrá asignarlos desde un entorno seguro.</Text>
              )}
              <Text style={styles.warning}>Nunca se puede asignar el rol de administrador desde esta pantalla.</Text>
            </View>}
          </>
        )}
        <Text style={styles.footer}>Moneda Mundial • Prototipo conectado a Supabase • No es un servicio financiero</Text>
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
