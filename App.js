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
  const [syncNotice, setSyncNotice] = useState('');
  const [swapWallet, setSwapWallet] = useState(null);
  const [swapFrom, setSwapFrom] = useState('COIN');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapQuote, setSwapQuote] = useState(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [pickupAmount, setPickupAmount] = useState('');
  const [pickupBusy, setPickupBusy] = useState(false);
  const [pickupResult, setPickupResult] = useState(null);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [pickupOrdersBusy, setPickupOrdersBusy] = useState(false);
  const [pickupCancelBusy, setPickupCancelBusy] = useState(false);
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const userId = session?.user?.id;

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
    pendingRef.current = null;
    setAmount('');
    setRecipientCode('');
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      setSwapWallet(null);
      setSwapQuote(null);
      return;
    }
    refreshAccount(userId);
    // Recuperar borradores pendientes después de reiniciar Android.
    // Nunca enviar automáticamente: el usuario debe revisar y confirmar.
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('mwd:pending-demo-operation:' + userId);
        if (!raw || !active) return;
        const saved = JSON.parse(raw);
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.id || '') ||
            !Number.isSafeInteger(saved.cents) || saved.cents < 1 ||
            saved.cents > LIMIT_CENTS || typeof saved.code !== 'string' ||
            !['transfer', 'contribution'].includes(saved.type)) {
          throw new Error('Datos pendientes inválidos.');
        }
        if (!active) return;
        pendingRef.current = saved;
        setAmount(formatMWD(saved.cents));
        setRecipientCode(saved.code);
        setScreen(saved.type === 'transfer' ? 'Transferir' : 'Aportar');
        message('Operación pendiente recuperada', 'Revisa los datos y confirma para consultar el servidor con la misma referencia. No se enviará automáticamente.');
      } catch (_error) {
        if (active) message('Operación pendiente', 'Hay datos locales que requieren revisión. No se enviará ninguna operación automáticamente.');
      }
    })();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('mwd:pending-demo-pickup:' + userId);
        if (!raw || !active) return;
        const saved = JSON.parse(raw);
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.id || '') ||
            saved.country !== 'HN' || !Number.isSafeInteger(saved.cents) ||
            saved.cents < 100 || saved.cents > 100000) {
          throw new Error('Orden pendiente inválida.');
        }
        if (!active) return;
        setPickupAmount(formatMWD(saved.cents));
        // No reemplazar la pantalla de una transferencia pendiente recuperada.
        const operationRaw = await AsyncStorage.getItem('mwd:pending-demo-operation:' + userId);
        if (!active) return;
        if (!operationRaw) setScreen('Retiros');
        message('Retiro ficticio pendiente', 'Se recuperó el importe. Revisa y confirma para reintentar con la misma referencia; no se enviará automáticamente.');
      } catch (_error) {
        if (active) message('Retiro pendiente', 'Hay una orden local pendiente que requiere revisión antes de crear otra.');
      }
    })();
    return () => { active = false; };
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!id) return;
    setSyncing(true);
    setSyncNotice('Actualizando...');
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
      if (supabase.auth.getUser && supabase.auth && id !== (await supabase.auth.getSession()).data.session?.user?.id) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
      setSyncNotice('Saldo e historial actualizados correctamente.');
    } catch (error) {
      setSyncNotice('No se pudo actualizar. Revisa el mensaje de error.');
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
    pendingRef.current = null;
  }
  function changeRecipient(value) {
    setRecipientCode(value);
    pendingRef.current = null;
  }

  async function executeOperation(type, cents, code = '') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (!userId) throw new Error('Inicia sesión antes de operar.');
      // Guardar el UUID antes de enviar: permite recuperarlo tras cerrar Android.
      const pendingKey = 'mwd:pending-demo-operation:' + userId;
      const savedRaw = await AsyncStorage.getItem(pendingKey);
      let saved = null;
      if (savedRaw) {
        try { saved = JSON.parse(savedRaw); }
        catch (_parseError) { throw new Error('Hay una operación pendiente ilegible. Requiere revisión antes de continuar.'); }
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.id || '') ||
            !['transfer', 'contribution'].includes(saved.type) ||
            !Number.isSafeInteger(saved.cents) || typeof saved.code !== 'string') {
          throw new Error('Hay una operación pendiente inválida. Requiere revisión antes de continuar.');
        }
        if (saved.type !== type || saved.cents !== cents || saved.code !== code) {
          throw new Error('Hay una operación pendiente con otros datos. Repite sus datos originales para verificarla antes de crear otra.');
        }
      }
      const request = saved || { type, cents, code, id: uniqueRequestId() };
      if (!saved) await AsyncStorage.setItem(pendingKey, JSON.stringify(request));
      pendingRef.current = request;
      const requestId = request.id;
      // Consultar primero por si la respuesta se perdió antes de cerrar la app.
      const previous = await supabase.rpc('mwd_operation_status_demo', { p_request_id: requestId });
      if (previous.error) throw new Error('No se pudo consultar el estado previo. No se enviará una nueva solicitud hasta verificarlo.');
      const already = previous.data;
      if (!already || !['processed', 'unconfirmed'].includes(already.status)) {
        throw new Error('Estado remoto inesperado. Operación detenida para revisión.');
      }
      const matches = !previous.error && already?.status === 'processed' &&
        already?.requestId === requestId && already?.amountCents === cents &&
        already?.kind === (type === 'transfer' ? 'transfer' : 'contribution') &&
        (type !== 'transfer' || already?.recipientCode === code);
      if (already?.status === 'processed' && !matches) {
        throw new Error('El servidor encontró una operación con datos diferentes. Requiere revisión.');
      }
      // El borrador pertenece a la cuenta activa, no a una sesión anterior.
      const activeSession = await supabase.auth.getSession();
      if (activeSession.error || activeSession.data.session?.user?.id !== userId) {
        throw new Error('La sesión cambió. No se enviará ninguna operación.');
      }
      const response = matches ? { data: { status: 'already_processed' }, error: null } :
        type === 'transfer'
        ? await supabase.rpc('mwd_transfer_demo', {
          p_recipient_code: code, p_amount_cents: cents, p_request_id: requestId,
        })
        : await supabase.rpc('mwd_contribute_demo', {
          p_amount_cents: cents, p_request_id: requestId,
        });
      if (response.error) throw response.error;
      if (!['ok', 'already_processed'].includes(response.data?.status)) {
        throw new Error('La operación no pudo ser confirmada.');
      }
      // El servidor ya confirmó la operación; errores de refresco no deben reintentarla.
      try { await AsyncStorage.removeItem(pendingKey); }
      catch (_storageError) { message('Sincronización pendiente', 'Operación confirmada; el registro local se verificará en el próximo intento.'); }
      pendingRef.current = null;
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      await refreshAccount();
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
    } catch (error) {
      // Una respuesta perdida no significa que la operación haya fallado.
      // Consultamos el servidor usando el mismo identificador de reintento.
      const pending = pendingRef.current;
      let verified = false;
      if (pending && pending.type === type && pending.cents === cents && pending.code === code) {
        try {
          const statusResponse = await supabase.rpc('mwd_operation_status_demo', {
            p_request_id: pending.id,
          });
          const result = statusResponse.data;
          if (!statusResponse.error && result?.status === 'processed' &&
              result?.requestId === pending.id && result?.amountCents === cents &&
              result?.kind === (type === 'transfer' ? 'transfer' : 'contribution') &&
              (type !== 'transfer' || result?.recipientCode === code)) {
            verified = true;
            await AsyncStorage.removeItem('mwd:pending-demo-operation:' + userId);
            pendingRef.current = null;
            setAmount('');
            setRecipientCode('');
            setScreen('Inicio');
            await refreshAccount();
            message('Operación ficticia verificada', 'El servidor confirma que la operación ya fue registrada. No se envió de nuevo.');
          }
        } catch (_statusError) {
          // Sin confirmación conservamos el mismo UUID para un reintento seguro.
        }
      }
      if (!verified) {
        message('Operación no confirmada',
          (error.message || 'Error desconocido') + '\nNo cambies los datos si deseas reintentar. El servidor evita duplicados con la misma referencia.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function prepareOperation(type) {
    if (busyRef.current) return;
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

  const microDisplay = value => (Number(value || 0) / 1000000).toFixed(6);

  async function loadSwapWallet() {
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (error) throw error;
      setSwapWallet(data);
    } catch (error) {
      message('Monedas de prueba', error.message || 'No se pudo cargar la billetera.');
    } finally {
      setSwapBusy(false);
    }
  }

  async function requestSwapQuote() {
    const normalized = swapAmount.trim().replace(',', '.');
    if (!/^(?:0|[1-9]\\d*)(?:\\.\\d{1,6})?$/.test(normalized)) {
      return message('Cantidad inválida', 'Usa hasta seis decimales.');
    }
    const [whole, fraction = ''] = normalized.split('.');
    const micro = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
    if (!Number.isSafeInteger(micro) || micro < 1000000 || micro > 10000000000) {
      return message('Cantidad inválida', 'Introduce entre 1 y 10,000 unidades de prueba.');
    }
    setSwapBusy(true);
    setSwapQuote(null);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_quote_demo', {
        p_from_asset: swapFrom, p_amount_micro: micro, p_client_request_id: uniqueRequestId(),
      });
      if (error) throw error;
      setSwapQuote(data);
    } catch (error) {
      message('Cotización', error.message || 'No se pudo cotizar.');
    } finally {
      setSwapBusy(false);
    }
  }

  async function confirmSwap() {
    if (!swapQuote?.quoteId || swapBusy) return;
    const quote = swapQuote;
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      setSwapQuote(null);
      return message('Cotización vencida', 'Solicita una cotización nueva.');
    }
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_confirm_demo', {
        p_quote_id: quote.quoteId,
      });
      if (error) throw error;
      if (!['ok', 'already_processed'].includes(data?.status)) throw new Error('Confirmación no reconocida.');
      setSwapQuote(null);
      setSwapAmount('');
      const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo');
      if (walletResponse.error) throw walletResponse.error;
      setSwapWallet(walletResponse.data);
      message('Conversión ficticia', 'Operación registrada correctamente.');
    } catch (error) {
      message('Conversión no confirmada', (error.message || 'Error desconocido') +
        '\\nConsulta los saldos antes de intentar otra conversión.');
    } finally {
      setSwapBusy(false);
    }
  }

  async function createDemoPickup() {
    if (pickupBusy) return;
    const cents = amountToCents(pickupAmount);
    if (cents === null || cents < 100 || cents > 100000) {
      return message('Monto inválido', 'Usa entre 1.00 y 1000.00 USD de referencia (solo simulación).');
    }
    setPickupBusy(true);
    setPickupResult(null);
    try {
      if (!userId) throw new Error('Inicia sesión antes de crear una orden.');
      const pendingKey = 'mwd:pending-demo-pickup:' + userId;
      const raw = await AsyncStorage.getItem(pendingKey);
      let saved = null;
      if (raw) {
        try { saved = JSON.parse(raw); }
        catch (_error) { throw new Error('Orden pendiente ilegible. Requiere revisión.'); }
        if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.id || '') ||
            saved.country !== 'HN' || !Number.isSafeInteger(saved.cents)) {
          throw new Error('Orden pendiente inválida. Requiere revisión.');
        }
        if (saved.cents !== cents) {
          throw new Error('Existe una orden pendiente con otro importe. Repite el importe original para recuperarla.');
        }
      }
      const request = saved || { id: uniqueRequestId(), country: 'HN', cents };
      if (!saved) await AsyncStorage.setItem(pendingKey, JSON.stringify(request));
      const activeSession = await supabase.auth.getSession();
      if (activeSession.error || activeSession.data.session?.user?.id !== userId) {
        throw new Error('La sesión cambió. No se creará ninguna orden.');
      }
      const { data, error } = await supabase.rpc('mwd_pickup_create_demo', {
        p_destination_country: request.country, p_amount_cents: request.cents,
        p_request_id: request.id,
      });
      if (error) throw error;
      if (!['created', 'already_created'].includes(data?.status)) throw new Error('Respuesta inesperada.');
      await AsyncStorage.removeItem(pendingKey);
      setPickupResult(data);
      setPickupAmount('');
      if (data.status === 'already_created' && !data.pickupCode) {
        message('Orden ficticia recuperada', 'La orden ya existía. Por seguridad el código secreto no se muestra de nuevo. Consulta tus órdenes; no crees otra para recuperar el código.');
      }
    } catch (error) {
      message('Orden ficticia no confirmada', (error.message || 'Error desconocido') +
        '\nReintenta con el mismo importe para conservar la referencia.');
    } finally {
      setPickupBusy(false);
    }
  }

  async function loadPickupOrders() {
    setPickupOrdersBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_my_orders_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de órdenes no reconocida.');
      setPickupOrders(data);
    } catch (error) {
      message('No se pudieron consultar las órdenes', error.message || 'Error desconocido');
    } finally {
      setPickupOrdersBusy(false);
    }
  }

  async function cancelDemoPickup(orderId) {
    if (pickupCancelBusy) return;
    setPickupCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_cancel_demo', { p_order_id: orderId });
      if (error) throw error;
      if (!['cancelled', 'already_cancelled'].includes(data?.status)) throw new Error('Respuesta de cancelación no reconocida.');
      message('Orden ficticia', data.status === 'cancelled' ? 'Orden cancelada correctamente.' : 'La orden ya estaba cancelada.');
      await loadPickupOrders();
    } catch (error) {
      message('No se pudo cancelar', error.message || 'Error desconocido');
    } finally {
      setPickupCancelBusy(false);
    }
  }

  function navigate(to) {
    setScreen(to);
    if (to === 'Convertir') loadSwapWallet();
    if (to === 'MisRetiros') loadPickupOrders();
    setAmount('');
    setRecipientCode('');
    pendingRef.current = null;
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
              <Btn title="Transferir MWD entre usuarios" onPress={() => navigate('Transferir')} disabled={!wallet} />
              <Btn title="Registrar aportación ficticia" onPress={() => navigate('Aportar')} disabled={!wallet} />
              <Btn title="Mis movimientos" secondary onPress={() => navigate('Historial')} />
              <Btn title="Remesas y retiros ficticios" secondary onPress={() => navigate("Retiros")} />
              <Btn title="Mis retiros ficticios" secondary onPress={() => navigate("MisRetiros")} />
              <Btn title="Coin / Digital (simulador)" secondary onPress={() => navigate('Convertir')} />
              <Btn title="Mi cuenta / recibir" secondary onPress={() => navigate('Cuenta')} />
              <Btn title={syncing ? "Actualizando..." : "Actualizar saldo e historial"} secondary onPress={() => refreshAccount()} disabled={syncing} />
              {!!syncNotice && <Text style={styles.muted}>{syncNotice}</Text>}
              <Btn title="Administración" secondary onPress={() => navigate('Admin')} />
              <Btn title="Cerrar sesión" secondary onPress={logout} />
            </>}

            {screen === 'MisRetiros' && <View style={styles.card}>
              <Text style={styles.heading}>Mis retiros ficticios</Text>
              <Text style={styles.muted}>Solo aparecen las órdenes de tu cuenta. No se entrega dinero real.</Text>
              <Btn title={pickupOrdersBusy ? 'Consultando...' : 'Actualizar mis órdenes'}
                secondary onPress={loadPickupOrders} disabled={pickupOrdersBusy || pickupCancelBusy} />
              {!pickupOrdersBusy && pickupOrders.length === 0 && <Text style={styles.muted}>No hay órdenes para mostrar.</Text>}
              {pickupOrders.map(order => (
                <View key={order.orderId} style={styles.card}>
                  <Text style={styles.small}>Destino: {order.destinationCountry === 'HN' ? 'Honduras' : order.destinationCountry}</Text>
                  <Text style={styles.small}>Monto de referencia: {formatMWD(order.amountCents)} {order.currency || 'moneda no indicada'} (simulación, sin dinero real)</Text>
                  <Text style={styles.small}>Estado: {order.status}</Text>
                  <Text style={styles.muted}>Creada: {new Date(order.createdAt).toLocaleString()}</Text>
                  <Text style={styles.muted}>Vence: {new Date(order.expiresAt).toLocaleString()}</Text>
                  <Text selectable style={styles.muted}>Referencia: {order.orderId}</Text>
                  {order.status === 'pending' && <Btn title={pickupCancelBusy ? 'Procesando...' : 'Cancelar esta orden'}
                    secondary disabled={pickupCancelBusy || pickupOrdersBusy}
                    onPress={() => confirmAction('Cancelar orden ficticia',
                      'Esta acción cancelará la orden seleccionada. No afecta dinero real.',
                      () => cancelDemoPickup(order.orderId))} />}
                </View>
              ))}
            </View>}

            {screen === 'Retiros' && <View style={styles.card}>
              <Text style={styles.heading}>Retiro ficticio a Honduras</Text>
              <Text style={styles.warning}>Solo simulación. No se entrega dinero real.</Text>
              <Text style={styles.muted}>Monto de referencia: 1.00 a 1000.00 USD (sin dinero real ni débito MWD)</Text>
              <TextInput style={styles.input} placeholder="Ejemplo: 10.00"
                placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                value={pickupAmount} onChangeText={setPickupAmount} editable={!pickupBusy} />
              <Text style={styles.muted}>Máximo 5 órdenes nuevas por hora por cuenta. Vigencia: 24 horas.</Text>
              <Btn title={pickupBusy ? 'Creando...' : 'Crear orden ficticia'}
                onPress={createDemoPickup} disabled={pickupBusy} />
              {!!pickupResult && <View>
                <Text style={styles.heading}>{pickupResult.status === 'created' ? 'Orden creada' : 'Orden existente'}</Text>
                <Text selectable style={styles.small}>Orden: {pickupResult.orderId}</Text>
                {!!pickupResult.pickupCode && <Text selectable style={styles.code}>Código de prueba: {pickupResult.pickupCode}</Text>}
                <Text style={styles.muted}>Vence: {pickupResult.expiresAt || 'No disponible'}</Text>
                <Text style={styles.warning}>No es válido para retirar dinero real.</Text>
              </View>}
            </View>}

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

            {screen === 'Convertir' && <View style={styles.card}>
              <Text style={styles.heading}>Coin ↔ Digital</Text>
              <Text style={styles.warning}>SIMULADOR • SIN PRECIO DE MERCADO NI RESPALDO REAL</Text>
              <Text style={styles.muted}>Coin: {swapWallet ? microDisplay(swapWallet.coinMicro) : '...'} COIN</Text>
              <Text style={styles.muted}>Digital: {swapWallet ? microDisplay(swapWallet.stableMicro) : '...'} DIGITAL</Text>
              <Btn title="Consultar saldos" secondary onPress={loadSwapWallet} disabled={swapBusy} />
              <Btn title={swapFrom === 'COIN' ? 'Origen: COIN (cambiar)' : 'Origen: DIGITAL (cambiar)'}
                secondary disabled={swapBusy} onPress={() => {
                  setSwapFrom(swapFrom === 'COIN' ? 'STABLE' : 'COIN');
                  setSwapQuote(null);
                }} />
              <TextInput style={styles.input} placeholder="Cantidad (mínimo 1)"
                keyboardType="decimal-pad" placeholderTextColor="#9fb1c8"
                value={swapAmount} onChangeText={value => { setSwapAmount(value); setSwapQuote(null); }} />
              <Btn title={swapBusy ? 'Procesando...' : 'Solicitar cotización ficticia'}
                disabled={swapBusy || !swapWallet} onPress={requestSwapQuote} />
              {swapQuote && <View>
                <Text style={styles.muted}>Recibirías: {microDisplay(swapQuote.amountOutMicro)} {swapQuote.toAsset === 'STABLE' ? 'DIGITAL' : 'COIN'}</Text>
                <Text style={styles.muted}>Comisión: {microDisplay(swapQuote.feeOutMicro)} {swapQuote.toAsset === 'STABLE' ? 'DIGITAL' : 'COIN'}</Text>
                <Text style={styles.muted}>Cotización válida hasta: {new Date(swapQuote.expiresAt).toLocaleTimeString()}</Text>
                <Btn title="Confirmar conversión ficticia" disabled={swapBusy}
                  onPress={() => confirmAction('Confirmar conversión ficticia',
                    'Esta operación modificará únicamente los saldos de prueba.', confirmSwap)} />
              </View>}
            </View>}

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
