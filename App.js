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
  const [merchant, setMerchant] = useState(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantCountry, setMerchantCountry] = useState('US');
  const [merchantRequests, setMerchantRequests] = useState([]);
  const [merchantAmount, setMerchantAmount] = useState('');
  const [merchantDescription, setMerchantDescription] = useState('');
  const [commercialBusy, setCommercialBusy] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentPreview, setPaymentPreview] = useState(null);
  const [worldCountries, setWorldCountries] = useState([]);
  const [worldLoading, setWorldLoading] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const [quoteCountry, setQuoteCountry] = useState('CR');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteMethod, setQuoteMethod] = useState('bank');
  const [quoteResult, setQuoteResult] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [ownerSummary, setOwnerSummary] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
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
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      setMerchant(null);
      setMerchantRequests([]);
      setPaymentPreview(null);
      setPaymentCode('');
      setWorldCountries([]);
      setQuoteResult(null);
      setOwnerSummary(null);
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
        supabase.rpc('mwd_history_demo'),
        supabase.from('mwd_admin_roles').select('role').eq('user_id', id).maybeSingle(),
      ]);
      if (w.error) throw w.error;
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      if (supabase.auth.getUser && supabase.auth && id !== (await supabase.auth.getSession()).data.session?.user?.id) return;
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
      const pending = pendingRef.current;
      if (!pending || pending.type !== type || pending.cents !== cents || pending.code !== code) {
        pendingRef.current = { type, cents, code, id: uniqueRequestId() };
      }
      const requestId = pendingRef.current.id;
      const response = type === 'transfer'
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
      pendingRef.current = null;
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      await refreshAccount();
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
    } catch (error) {
      message('Operación no confirmada',
        (error.message || 'Error desconocido') + '\nPuedes reintentar sin cambiar los datos.');
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

  async function loadMerchant() {
    if (!userId) return;
    setCommercialBusy(true);
    try {
      const [m, requests] = await Promise.all([
        supabase.from('mwd_merchants')
          .select('owner_user_id,business_name,country_code')
          .eq('owner_user_id', userId).maybeSingle(),
        supabase.from('mwd_payment_requests')
          .select('id,amount_cents,status,description,created_at')
          .eq('merchant_user_id', userId)
          .order('created_at', { ascending: false }).limit(30),
      ]);
      if (m.error) throw m.error;
      if (requests.error) throw requests.error;
      if (userId !== (await supabase.auth.getSession()).data.session?.user?.id) return;
      setMerchant(m.data);
      setMerchantName(m.data?.business_name || '');
      setMerchantCountry(m.data?.country_code || 'US');
      setMerchantRequests(requests.data || []);
    } catch (error) {
      message('Mi comercio', error.message || 'No se pudieron cargar los datos.');
    } finally {
      setCommercialBusy(false);
    }
  }

  async function saveMerchant() {
    const name = merchantName.trim();
    const country = merchantCountry.trim().toUpperCase();
    if (name.length < 2 || name.length > 120 || !/^[A-Z]{2}$/.test(country)) {
      return message('Datos inválidos', 'Nombre de 2 a 120 letras y país ISO de 2 letras.');
    }
    if (!userId || commercialBusy) return;
    setCommercialBusy(true);
    try {
      const { error } = await supabase.from('mwd_merchants').upsert({
        owner_user_id: userId, business_name: name, country_code: country,
      }, { onConflict: 'owner_user_id' });
      if (error) throw error;
      message('Comercio', 'Comercio de demostración guardado.');
      await loadMerchant();
    } catch (error) {
      message('Mi comercio', error.message || 'No fue posible guardar.');
    } finally {
      setCommercialBusy(false);
    }
  }

  async function createPaymentRequest() {
    const cents = amountToCents(merchantAmount);
    if (!merchant || commercialBusy) return;
    if (cents === null || merchantDescription.length > 240) {
      return message('Datos inválidos', 'Verifica el importe y la descripción (máximo 240 caracteres).');
    }
    setCommercialBusy(true);
    try {
      const { data, error } = await supabase.from('mwd_payment_requests')
        .insert({
          merchant_user_id: userId,
          amount_cents: cents, currency_code: 'MWD', status: 'pending',
          description: merchantDescription.trim(),
        }).select('id').single();
      if (error) throw error;
      setMerchantAmount('');
      setMerchantDescription('');
      message('Cobro ficticio creado', 'Identificador para compartir: ' + data.id);
      await loadMerchant();
    } catch (error) {
      message('Mi comercio', error.message || 'No se pudo crear el cobro.');
    } finally {
      setCommercialBusy(false);
    }
  }

  function cancelPaymentRequest(id) {
    confirmAction('Cancelar solicitud', '¿Cancelar esta solicitud ficticia?', async () => {
      if (commercialBusy) return;
      setCommercialBusy(true);
      try {
        const { error } = await supabase.rpc('mwd_cancel_payment_request_demo', { p_payment_id: id });
        if (error) throw error;
        await loadMerchant();
      } catch (error) {
        message('Cancelación', error.message || 'No se pudo cancelar.');
      } finally {
        setCommercialBusy(false);
      }
    });
  }

  async function lookupPayment() {
    const code = paymentCode.trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code)) {
      return message('Código incorrecto', 'Introduce un identificador válido de solicitud.');
    }
    if (commercialBusy) return;
    setPaymentPreview(null);
    setCommercialBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_get_payment_request_demo', { p_payment_id: code });
      if (error) throw error;
      if (data?.id !== code || data?.status !== 'pending' || data?.currency_code !== 'MWD') {
        throw new Error('Solicitud ficticia no disponible.');
      }
      setPaymentPreview(data);
    } catch (error) {
      message('Consultar solicitud', error.message || 'No fue posible consultar.');
    } finally {
      setCommercialBusy(false);
    }
  }

  function payMerchant() {
    const request = paymentPreview;
    if (!request || commercialBusy) return;
    if (!wallet || request.amount_cents > wallet.balance_cents) {
      return message('Saldo insuficiente', 'Actualiza tu saldo y comprueba los MWD ficticios.');
    }
    confirmAction('Pagar comercio (prueba)',
      'Comercio: ' + request.business_name + '\nImporte: ' + formatMWD(request.amount_cents) + ' MWD ficticios.',
      async () => {
        if (commercialBusy) return;
        setCommercialBusy(true);
        try {
          const { data, error } = await supabase.rpc('mwd_pay_merchant_demo', {
            p_payment_id: request.id,
          });
          if (error) throw error;
          if (!['ok', 'already_processed'].includes(data?.status)) {
            throw new Error('Pago no confirmado.');
          }
          setPaymentPreview(null);
          setPaymentCode('');
          await refreshAccount();
          message('Pago de prueba', 'Pago ficticio registrado. Puedes consultar tu historial.');
        } catch (error) {
          message('Pago no confirmado', error.message || 'No se pudo completar.');
        } finally {
          setCommercialBusy(false);
        }
      });
  }

  async function loadWorldCountries() {
    if (!userId || worldLoading) return;
    setWorldLoading(true);
    try {
      const { data, error } = await supabase.rpc('mwd_world_countries_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('La lista de países no está disponible.');
      if (userId !== (await supabase.auth.getSession()).data.session?.user?.id) return;
      setWorldCountries(data);
    } catch (error) {
      message('Países del mundo', error.message || 'No se pudo cargar el catálogo.');
    } finally {
      setWorldLoading(false);
    }
  }

  async function getInternationalQuote() {
    const country = quoteCountry.trim().toUpperCase();
    const cents = amountToCents(quoteAmount);
    if (!/^[A-Z]{2}$/.test(country) || cents === null || cents < 100 || cents > 10000000) {
      return message('Simulación', 'País ISO de dos letras y cantidad desde 1 hasta 100,000 USD.');
    }
    if (quoteBusy || !userId) return;
    setQuoteBusy(true);
    setQuoteResult(null);
    try {
      const { data, error } = await supabase.rpc('mwd_quote_international_demo', {
        p_destination_country: country,
        p_amount_cents: cents,
        p_method: quoteMethod,
      });
      if (error) throw error;
      if (data?.status !== 'simulation_only' || data?.realPaymentsEnabled !== false) {
        throw new Error('Solo se permiten cotizaciones de demostración.');
      }
      if (userId !== (await supabase.auth.getSession()).data.session?.user?.id) return;
      setQuoteResult(data);
    } catch (error) {
      message('Simulación internacional', error.message || 'Ruta de prueba no disponible.');
    } finally {
      setQuoteBusy(false);
    }
  }

  async function loadOwnerSummary() {
    if (!userId || adminRole !== 'owner' || ownerLoading) return;
    setOwnerLoading(true);
    try {
      const { data, error } = await supabase.rpc('mwd_owner_summary_demo');
      if (error) throw error;
      if (userId !== (await supabase.auth.getSession()).data.session?.user?.id) return;
      setOwnerSummary(data);
    } catch (error) {
      message('Administración', error.message || 'No se pudo consultar el resumen.');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) message('Salida', error.message);
  }

  function navigate(to) {
    setScreen(to);
    setAmount('');
    setRecipientCode('');
    pendingRef.current = null;
    if (to === 'Comercio') loadMerchant();
    if (to === 'Pagar') setPaymentPreview(null);
    if (to === 'Paises') loadWorldCountries();
    if (to === 'Simulador') setQuoteResult(null);
    if (to === 'Admin' && adminRole === 'owner') loadOwnerSummary();
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
              <Btn title="Mi comercio y solicitudes de cobro" secondary onPress={() => navigate('Comercio')} />
              <Btn title="Pagar solicitud comercial ficticia" secondary onPress={() => navigate('Pagar')} />
              <Btn title="Países del mundo y disponibilidad" secondary onPress={() => navigate('Paises')} />
              <Btn title="Simulador internacional de comisiones" secondary onPress={() => navigate('Simulador')} />
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

            {screen === 'Comercio' && <View style={styles.card}>
              <Text style={styles.heading}>Mi comercio y solicitudes de cobro</Text>
              <Text style={styles.warning}>SOLO CRÉDITOS FICTICIOS MWD</Text>
              <TextInput style={styles.input} placeholder="Nombre comercial"
                placeholderTextColor="#9fb1c8" maxLength={120}
                value={merchantName} onChangeText={setMerchantName} />
              <TextInput style={styles.input} placeholder="País ISO (US, CR, HN)"
                placeholderTextColor="#9fb1c8" maxLength={2} autoCapitalize="characters"
                value={merchantCountry} onChangeText={setMerchantCountry} />
              <Btn title={merchant ? 'Actualizar comercio' : 'Registrar comercio'}
                onPress={saveMerchant} disabled={commercialBusy} />
              {merchant && <>
                <Text style={styles.heading}>Crear solicitud</Text>
                <TextInput style={styles.input} placeholder="Cantidad ficticia MWD"
                  placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                  value={merchantAmount} onChangeText={setMerchantAmount} />
                <TextInput style={styles.input} placeholder="Descripción del cobro"
                  placeholderTextColor="#9fb1c8" maxLength={240}
                  value={merchantDescription} onChangeText={setMerchantDescription} />
                <Btn title="Crear cobro ficticio" disabled={commercialBusy}
                  onPress={createPaymentRequest} />
              </>}
              <Text style={styles.heading}>Mis solicitudes</Text>
              {merchantRequests.length === 0 && <Text style={styles.muted}>No hay solicitudes.</Text>}
              {merchantRequests.map(req => (
                <View key={req.id} style={styles.entry}>
                  <Text style={styles.itemHeading}>{formatMWD(req.amount_cents)} MWD • {req.status}</Text>
                  <Text style={styles.muted}>{req.description || 'Sin descripción'}</Text>
                  <Text selectable style={styles.small}>Código: {req.id}</Text>
                  {req.status === 'pending' && <Btn title="Cancelar solicitud" secondary
                    disabled={commercialBusy} onPress={() => cancelPaymentRequest(req.id)} />}
                </View>
              ))}
              <Btn title="Actualizar solicitudes" secondary onPress={loadMerchant} disabled={commercialBusy} />
            </View>}

            {screen === 'Pagar' && <View style={styles.card}>
              <Text style={styles.heading}>Pagar a un comercio</Text>
              <Text style={styles.warning}>PAGO EXCLUSIVAMENTE FICTICIO</Text>
              <Text style={styles.muted}>Introduce el identificador de la solicitud que te compartió el comercio.</Text>
              <TextInput style={styles.input} placeholder="Código de solicitud (UUID)"
                placeholderTextColor="#9fb1c8" autoCapitalize="none"
                autoCorrect={false} value={paymentCode}
                onChangeText={v => { setPaymentCode(v); setPaymentPreview(null); }} />
              <Btn title="Consultar solicitud" disabled={commercialBusy} onPress={lookupPayment} />
              {paymentPreview && <View style={styles.entry}>
                <Text style={styles.itemHeading}>{paymentPreview.business_name}</Text>
                <Text style={styles.balance}>{formatMWD(paymentPreview.amount_cents)} MWD</Text>
                <Text style={styles.muted}>{paymentPreview.description || 'Cobro de prueba'}</Text>
                <Btn title="Confirmar pago ficticio" disabled={commercialBusy}
                  onPress={payMerchant} />
              </View>}
            </View>}

            {screen === 'Paises' && <View style={styles.card}>
              <Text style={styles.heading}>Países del mundo</Text>
              <Text style={styles.warning}>NINGÚN PAÍS TIENE PAGOS REALES ACTIVADOS</Text>
              <Text style={styles.muted}>
                Catálogo informativo de destinos. Una simulación disponible no significa autorización legal.
              </Text>
              <TextInput style={styles.input} placeholder="Buscar nombre o código de país"
                placeholderTextColor="#9fb1c8" value={countryFilter}
                onChangeText={setCountryFilter} autoCorrect={false} />
              <Text style={styles.small}>Países registrados: {worldCountries.length}</Text>
              <Btn title={worldLoading ? 'Cargando...' : 'Actualizar países'} secondary
                onPress={loadWorldCountries} disabled={worldLoading} />
              {worldCountries.filter(item =>
                item.name.toLowerCase().includes(countryFilter.trim().toLowerCase()) ||
                item.code.toLowerCase().includes(countryFilter.trim().toLowerCase())
              ).slice(0, 30).map(item => (
                <TouchableOpacity key={item.code} style={styles.entry}
                  accessibilityRole="button"
                  onPress={() => {
                    setQuoteCountry(item.code);
                    navigate('Simulador');
                  }}>
                  <Text style={styles.itemHeading}>{item.name} ({item.code})</Text>
                  <Text style={styles.muted}>
                    {item.demoAvailable ? 'Simulador disponible' : 'Simulador no disponible'}
                    {' • '}Sin operaciones con dinero real
                  </Text>
                </TouchableOpacity>
              ))}
              {worldCountries.length > 30 && <Text style={styles.muted}>
                Se muestran hasta 30 resultados. Escribe un país para buscar otros destinos.
              </Text>}
            </View>}

            {screen === 'Simulador' && <View style={styles.card}>
              <Text style={styles.heading}>Simulador internacional</Text>
              <Text style={styles.warning}>COTIZACIONES ILUSTRATIVAS • SIN CAMBIO REAL DE DIVISAS</Text>
              <Text style={styles.muted}>Origen: Estados Unidos (USD). Rutas de simulación de ejemplo: CR, HN, CO, GT.</Text>
              <TextInput style={styles.input} placeholder="País de destino (CR)"
                placeholderTextColor="#9fb1c8" maxLength={2}
                autoCapitalize="characters" value={quoteCountry}
                onChangeText={v => { setQuoteCountry(v); setQuoteResult(null); }} />
              <TextInput style={styles.input} placeholder="Cantidad en dólares (USD)"
                placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                value={quoteAmount} onChangeText={v => { setQuoteAmount(v); setQuoteResult(null); }} />
              <Text style={styles.itemHeading}>Método hipotético</Text>
              <Btn title={quoteMethod === 'bank' ? '✓ Cuenta bancaria' : 'Cuenta bancaria'}
                secondary onPress={() => { setQuoteMethod('bank'); setQuoteResult(null); }} />
              <Btn title={quoteMethod === 'card' ? '✓ Tarjeta' : 'Tarjeta'}
                secondary onPress={() => { setQuoteMethod('card'); setQuoteResult(null); }} />
              <Btn title={quoteBusy ? 'Calculando...' : 'Calcular comisión de prueba'}
                onPress={getInternationalQuote} disabled={quoteBusy} />
              {quoteResult && <View style={styles.entry}>
                <Text style={styles.itemHeading}>{quoteResult.country} ({quoteResult.destination})</Text>
                <Text style={styles.small}>Envío hipotético: {formatMWD(quoteResult.amountCents)} USD</Text>
                <Text style={styles.small}>Comisión ilustrativa: {formatMWD(quoteResult.feeCents)} USD</Text>
                <Text style={styles.amount}>Total estimado: {formatMWD(quoteResult.totalPayCents)} USD</Text>
                <Text style={styles.muted}>Moneda destino: {quoteResult.destinationCurrency}</Text>
                <Text style={styles.warning}>
                  {quoteResult.receiverAmountCents == null
                    ? 'No existe una tasa de cambio real ni un monto confirmado a recibir.'
                    : 'Monto hipotético a recibir: ' + formatMWD(quoteResult.receiverAmountCents) + ' USD'}
                </Text>
                <Text style={styles.muted}>No se ha reservado precio, ejecutado conversión ni enviado dinero.</Text>
              </View>}
            </View>}

            {screen === 'Historial' && <>
              <Text style={styles.heading}>Mis últimos movimientos</Text>
              {operations.length === 0 && <Text style={styles.muted}>Todavía no hay movimientos en línea.</Text>}
              {operations.map(op => {
                const sent = op.kind === 'contribution' || op.source_user_id === userId;
                const label = op.kind === 'contribution'
                  ? 'Aportación ficticia'
                  : op.is_merchant_payment
                    ? (sent ? 'Pago a comercio (prueba)' : 'Cobro comercial recibido (prueba)')
                    : (sent ? 'Transferencia enviada' : 'Transferencia recibida');
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
              {adminRole ? (
                <>
                  <Text style={styles.muted}>Rol registrado: {adminRole}.</Text>
                  {adminRole === 'owner' && <>
                    <Btn title="Actualizar resumen de pruebas"
                      secondary onPress={loadOwnerSummary} disabled={ownerLoading} />
                    {ownerSummary && <View style={styles.entry}>
                      <Text style={styles.itemHeading}>Datos de demostración</Text>
                      <Text style={styles.small}>Cuentas de prueba: {ownerSummary.cuentas}</Text>
                      <Text style={styles.small}>Comercios de prueba: {ownerSummary.comercios}</Text>
                      <Text style={styles.small}>Transferencias ficticias: {ownerSummary.transferencias}</Text>
                      <Text style={styles.small}>Aportaciones ficticias: {ownerSummary.aportaciones}</Text>
                      <Text style={styles.small}>Cobros ficticios pagados: {ownerSummary.cobros_pagados}</Text>
                      <Text style={styles.muted}>Saldo conjunto ficticio: {formatMWD(ownerSummary.saldo_demo_centavos)} MWD</Text>
                    </View>}
                  </>}
                </>
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
