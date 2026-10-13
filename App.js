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
import { amountToCents, formatMWD, normalizeRecipientCode, normalizePaymentRequestId } from './src/demo-money.mjs';

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
  const [merchant, setMerchant] = useState(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantCountry, setMerchantCountry] = useState('US');
  const [merchantAmount, setMerchantAmount] = useState('');
  const [merchantDescription, setMerchantDescription] = useState('');
  const [merchantRequests, setMerchantRequests] = useState([]);
  const [merchantBusy, setMerchantBusy] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentPreview, setPaymentPreview] = useState(null);
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
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      setMerchant(null);
      setMerchantRequests([]);
      setMerchantName('');
      setPaymentPreview(null);
      setPaymentCode('');
      return;
    }
    refreshAccount(userId);
    refreshMerchant(userId);
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

  async function refreshMerchant(id = userId) {
    if (!id) return;
    try {
      const [m, r] = await Promise.all([
        supabase.from('mwd_merchants')
          .select('owner_user_id,business_name,country_code')
          .eq('owner_user_id', id).maybeSingle(),
        supabase.from('mwd_payment_requests')
          .select('id,amount_cents,currency_code,status,description,created_at')
          .eq('merchant_user_id', id)
          .order('created_at', { ascending: false }).limit(20),
      ]);
      if (m.error) throw m.error;
      if (r.error) throw r.error;
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (activeSession?.user?.id !== id) return;
      setMerchant(m.data);
      setMerchantRequests(r.data || []);
      if (m.data) {
        setMerchantName(m.data.business_name);
        setMerchantCountry(m.data.country_code);
      }
    } catch (error) {
      message('Comercios', error.message || 'No se pudo consultar el comercio.');
    }
  }

  async function saveMerchant() {
    const business_name = merchantName.trim();
    const country_code = merchantCountry.trim().toUpperCase();
    if (business_name.length < 2 || business_name.length > 120) {
      return message('Comercio', 'El nombre debe tener entre 2 y 120 caracteres.');
    }
    if (!/^[A-Z]{2}$/.test(country_code)) {
      return message('País', 'Introduce un código ISO de dos letras, por ejemplo US o HN.');
    }
    if (!userId || merchantBusy) return;
    setMerchantBusy(true);
    try {
      const { error } = await supabase.from('mwd_merchants').upsert({
        owner_user_id: userId, business_name, country_code,
      }, { onConflict: 'owner_user_id' });
      if (error) throw error;
      await refreshMerchant(userId);
      message('Comercio de prueba', 'Datos del comercio guardados en Supabase.');
    } catch (error) {
      message('Comercio', error.message || 'No se pudo guardar el comercio.');
    } finally {
      setMerchantBusy(false);
    }
  }

  async function createMerchantRequest() {
    const cents = amountToCents(merchantAmount);
    if (cents === null) {
      return message('Cantidad', 'Importe inválido. Máximo 1,000,000 MWD ficticios.');
    }
    const description = merchantDescription.trim();
    if (description.length > 240) {
      return message('Descripción', 'Máximo 240 caracteres.');
    }
    if (!merchant || !userId || merchantBusy) {
      return message('Comercio', 'Primero registra tu comercio de prueba.');
    }
    setMerchantBusy(true);
    try {
      const { error } = await supabase.from('mwd_payment_requests').insert({
        merchant_user_id: userId, amount_cents: cents,
        currency_code: 'MWD', status: 'pending', description: description || null,
      });
      if (error) throw error;
      setMerchantAmount('');
      setMerchantDescription('');
      await refreshMerchant(userId);
      message('Cobro de demostración', 'Solicitud creada. Comparte su identificador UUID con el cliente de prueba.');
    } catch (error) {
      message('Cobro', error.message || 'No se pudo crear la solicitud.');
    } finally {
      setMerchantBusy(false);
    }
  }

  function cancelMerchantRequest(id) {
    if (merchantBusy) return;
    confirmAction('Cancelar cobro ficticio', 'Esta solicitud ya no podrá pagarse.', async () => {
      setMerchantBusy(true);
      try {
        const { data, error } = await supabase.rpc('mwd_cancel_payment_request_demo', {
          p_payment_id: id,
        });
        if (error) throw error;
        if (data?.status !== 'cancelled' && data?.status !== 'expired') {
          throw new Error('No se confirmó la cancelación.');
        }
        await refreshMerchant();
      } catch (error) {
        message('Cancelación', error.message || 'No se pudo cancelar el cobro.');
      } finally {
        setMerchantBusy(false);
      }
    });
  }

  async function lookupMerchantPayment() {
    const id = normalizePaymentRequestId(paymentCode);
    if (!id) {
      return message('Código', 'Introduce el identificador UUID de la solicitud.');
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPaymentPreview(null);
    try {
      const { data, error } = await supabase.rpc('mwd_get_payment_request_demo', {
        p_payment_id: id,
      });
      if (error) throw error;
      if (!data || data.id !== id) throw new Error('No se encontró la solicitud.');
      setPaymentPreview(data);
    } catch (error) {
      message('Consultar cobro', error.message || 'No se encontró el cobro.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirmMerchantPayment() {
    if (!paymentPreview || paymentPreview.status !== 'pending' || busyRef.current) return;
    if (!wallet || paymentPreview.amount_cents > wallet.balance_cents) {
      return message('Saldo insuficiente', 'No tienes MWD ficticios suficientes.');
    }
    const id = paymentPreview.id;
    confirmAction('Pagar comercio de prueba',
      'Comercio: ' + paymentPreview.business_name +
      '\nCantidad: ' + formatMWD(paymentPreview.amount_cents) +
      ' MWD ficticios\nNo se mueve dinero real.',
      () => payMerchant(id));
  }

  async function payMerchant(id) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pay_merchant_demo', {
        p_payment_id: id,
      });
      if (error) throw error;
      if (!['ok', 'already_processed'].includes(data?.status)) {
        throw new Error('No se pudo confirmar el pago ficticio.');
      }
      setPaymentPreview(null);
      setPaymentCode('');
      await refreshAccount();
      await refreshMerchant();
      message('Pago de demostración', 'Pago ficticio registrado en Supabase.');
    } catch (error) {
      message('Pago no confirmado',
        (error.message || 'Error desconocido') +
        '\nConsulta de nuevo el estado antes de reintentar.');
    } finally {
      busyRef.current = false;
      setBusy(false);
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
    const code = type === 'transfer' ? normalizeRecipientCode(recipientCode) : '';
    if (type === 'transfer') {
      if (!code) {
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
              <Btn title="Mi comercio y cobros de prueba" secondary onPress={() => navigate('Comercio')} />
              <Btn title="Pagar a un comercio de prueba" secondary onPress={() => navigate('PagarComercio')} />
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

            {screen === 'Comercio' && <>
              <View style={styles.card}>
                <Text style={styles.heading}>Mi comercio de demostración</Text>
                <Text style={styles.muted}>Registra tu comercio para emitir cobros de prueba en MWD.</Text>
                <TextInput style={styles.input} placeholder="Nombre del comercio"
                  placeholderTextColor="#9fb1c8" maxLength={120}
                  value={merchantName} onChangeText={setMerchantName} />
                <TextInput style={styles.input} placeholder="País ISO, ejemplo US"
                  placeholderTextColor="#9fb1c8" maxLength={2}
                  autoCapitalize="characters" autoCorrect={false}
                  value={merchantCountry} onChangeText={setMerchantCountry} />
                <Btn title={merchantBusy ? 'Guardando...' : 'Guardar comercio de prueba'}
                  onPress={saveMerchant} disabled={merchantBusy} />
              </View>
              {merchant && <View style={styles.card}>
                <Text style={styles.heading}>Crear solicitud de cobro</Text>
                <Text style={styles.muted}>Solo créditos ficticios. No se emiten facturas ni se cobra dinero real.</Text>
                <TextInput style={styles.input} placeholder="Cantidad en MWD"
                  placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                  value={merchantAmount} onChangeText={setMerchantAmount} />
                <TextInput style={styles.input} placeholder="Descripción (opcional)"
                  placeholderTextColor="#9fb1c8" maxLength={240}
                  value={merchantDescription} onChangeText={setMerchantDescription} />
                <Btn title={merchantBusy ? 'Procesando...' : 'Generar cobro ficticio'}
                  onPress={createMerchantRequest} disabled={merchantBusy} />
              </View>}
              <Text style={styles.heading}>Mis últimas solicitudes</Text>
              <Btn title="Actualizar solicitudes" secondary onPress={() => refreshMerchant()}
                disabled={merchantBusy} />
              {merchantRequests.length === 0 &&
                <Text style={styles.muted}>Todavía no hay solicitudes de cobro.</Text>}
              {merchantRequests.map(request => <View style={styles.entry} key={request.id}>
                <Text style={styles.itemHeading}>{formatMWD(request.amount_cents)} MWD ficticios</Text>
                <Text style={styles.small}>Estado: {request.status}</Text>
                {request.description ? <Text style={styles.small}>{request.description}</Text> : null}
                <Text selectable style={styles.code}>{request.id}</Text>
                <Text style={styles.muted}>Comparte este código con el cliente de prueba.</Text>
                {request.status === 'pending' &&
                  <Btn title="Cancelar solicitud" secondary disabled={merchantBusy}
                    onPress={() => cancelMerchantRequest(request.id)} />}
              </View>)}
            </>}

            {screen === 'PagarComercio' && <View style={styles.card}>
              <Text style={styles.heading}>Pagar a un comercio de prueba</Text>
              <Text style={styles.muted}>Pide al comercio el identificador UUID de su solicitud de cobro.</Text>
              <TextInput style={styles.input} placeholder="Identificador de solicitud UUID"
                placeholderTextColor="#9fb1c8" autoCapitalize="none"
                autoCorrect={false} value={paymentCode}
                onChangeText={value => { setPaymentCode(value); setPaymentPreview(null); }} />
              <Btn title={busy ? 'Consultando...' : 'Consultar cobro ficticio'}
                disabled={busy} onPress={lookupMerchantPayment} />
              {paymentPreview && <View>
                <Text style={styles.itemHeading}>Comercio: {paymentPreview.business_name}</Text>
                <Text style={styles.balance}>{formatMWD(paymentPreview.amount_cents)} MWD</Text>
                <Text style={styles.muted}>Estado: {paymentPreview.status}</Text>
                {paymentPreview.description &&
                  <Text style={styles.muted}>{paymentPreview.description}</Text>}
                {paymentPreview.status === 'pending' &&
                  <Btn title={busy ? 'Procesando...' : 'Confirmar pago ficticio'}
                    disabled={busy} onPress={confirmMerchantPayment} />}
              </View>}
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
              {adminRole ? (
                <Text style={styles.muted}>Tu rol registrado es: {adminRole}. Las herramientas administrativas se implementarán por separado.</Text>
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
