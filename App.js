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
  StyleSheet, Alert, Platform, StatusBar, Share, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { amountToCents, formatMWD, normalizeRecipientCode, normalizePaymentRequestId } from './src/demo-money.mjs';

// CLAVE PUBLICABLE de Supabase. Nunca coloques claves secret/service_role en App.js.
const SUPABASE_URL = 'https://egrsdrlpavrtbgxoyxvg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sKotmweOAug6XqTR16U9Wg_ugxAx3vm';
const RECOVERY_REDIRECT_URL = 'monedamundial://auth/recovery';
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

async function shareDemoCode(kind, value) {
  if (!value) return;
  const label = kind === 'wallet'
    ? 'Mi identificador de billetera de demostración:'
    : 'Solicitud de cobro ficticio de Moneda Mundial:';
  try {
    await Share.share({ message: label + '\n' + value + '\nSOLO PRUEBAS - SIN DINERO REAL' });
  } catch (error) {
    message('Compartir', error.message || 'No fue posible compartir el código.');
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
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
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
  const recoveryInProgressRef = useRef(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
      if (event === 'SIGNED_OUT') {
        recoveryInProgressRef.current = false;
        setScreen('Inicio');
      } else if (event === 'PASSWORD_RECOVERY' ||
                 (recoveryInProgressRef.current && nextSession)) {
        setScreen('NuevaContrasena');
      } else if (event === 'SIGNED_IN') {
        setScreen('Inicio');
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Capturar enlaces de restablecimiento dirigidos exclusivamente a esta app.
  useEffect(() => {
    let active = true;
    async function onRecoveryUrl(url) {
      if (!active || typeof url !== 'string' ||
          !url.startsWith(RECOVERY_REDIRECT_URL)) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'monedamundial:' || parsed.hostname !== 'auth' ||
            parsed.pathname !== '/recovery') return;
        const params = new URLSearchParams(parsed.hash.slice(1));
        if (params.has('error') || params.has('error_code')) {
          throw new Error('Enlace caducado o inválido. Solicita otro.');
        }
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (params.get('type') !== 'recovery' || !access_token || !refresh_token) {
          throw new Error('Enlace incompleto.');
        }
        recoveryInProgressRef.current = true;
        const { data, error } = await supabase.auth.setSession({
          access_token, refresh_token,
        });
        if (error) throw error;
        if (!data?.session) throw new Error('No se pudo confirmar la sesión.');
        if (active) setScreen('NuevaContrasena');
      } catch (error) {
        recoveryInProgressRef.current = false;
        if (active) message('Recuperación', error.message || 'Solicita otro enlace.');
      }
    }
    Linking.getInitialURL().then(onRecoveryUrl).catch(() => {});
    const linkSubscription = Linking.addEventListener('url', ({ url }) => onRecoveryUrl(url));
    return () => { active = false; linkSubscription.remove(); };
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


  // Enlace nativo de recuperación; no requiere plantilla SMTP personalizada.
  async function requestPasswordReset() {
    const requestedEmail = recoveryEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(requestedEmail)) {
      return message('Correo', 'Introduce un correo electrónico válido.');
    }
    if (recoveryBusy) return;
    setRecoveryBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(requestedEmail, {
        redirectTo: RECOVERY_REDIRECT_URL,
      });
      if (error) throw error;
      setRecoveryEmail(requestedEmail);
      setScreen('VerificarCodigo');
      message('Revisa tu correo', 'Si la cuenta existe, recibirás un enlace seguro. Ábrelo en este teléfono para volver a Moneda Mundial.');
    } catch (error) {
      message('Recuperación', error.message || 'No se pudo enviar el correo.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function saveNewPassword() {
    if (newPassword.length < 12) {
      return message('Contraseña', 'Utiliza al menos 12 caracteres para tu nueva contraseña.');
    }
    if (newPassword !== confirmNewPassword) {
      return message('Contraseña', 'Las dos contraseñas no coinciden.');
    }
    if (recoveryBusy || !session) return;
    setRecoveryBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmNewPassword('');
      recoveryInProgressRef.current = false;
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;
      setEmail(recoveryEmail);
      setScreen('Inicio');
      message('Contraseña actualizada', 'Vuelve a iniciar sesión con tu nueva contraseña.');
    } catch (error) {
      message('Cambio no confirmado', 'No pudimos completar todo el proceso. Revisa la sesión antes de volver a intentarlo.');
    } finally {
      setRecoveryBusy(false);
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
        <View style={styles.brandHeader}>
          <View style={styles.brandIcon}><Text style={styles.brandIconText}>◎</Text></View>
          <View style={styles.brandWords}>
            <Text style={styles.logo}>MONEDA MUNDIAL</Text>
            <Text style={styles.sub}>Tu mundo, una billetera</Text>
          </View>
          <View style={styles.versionPill}><Text style={styles.versionText}>2.0</Text></View>
        </View>
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>MODO DEMOSTRACIÓN · SIN DINERO REAL</Text>
        </View>

        {authLoading ? <Text style={styles.loadingText}>Estamos preparando tu cuenta</Text> : !session && screen === 'RecuperarAcceso' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Recuperar mi contraseña</Text>
            <Text style={styles.muted}>Introduce tu correo. Recibirás un código de recuperación, sin necesidad de abrir enlaces externos.</Text>
            <TextInput style={styles.input} placeholder="Correo electrónico"
              accessibilityLabel="Correo para recuperación"
              placeholderTextColor="#9fb1c8" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={recoveryEmail}
              onChangeText={setRecoveryEmail} />
            <Btn title={recoveryBusy ? 'Enviando...' : 'Enviar código de recuperación'}
              disabled={recoveryBusy} onPress={requestPasswordReset} />
            <Btn title="← Volver a iniciar sesión" secondary
              disabled={recoveryBusy} onPress={() => setScreen('Inicio')} />
          </View>
        ) : !session && screen === 'VerificarCodigo' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Revisa tu correo</Text>
            <Text style={styles.muted}>Abre el enlace de recuperación enviado a {recoveryEmail} en este teléfono. Regresarás a Moneda Mundial para crear una contraseña nueva.</Text>
            <Btn title="Reenviar enlace" secondary disabled={recoveryBusy} onPress={requestPasswordReset} />
            <Btn title="← Volver" secondary disabled={recoveryBusy} onPress={() => setScreen('RecuperarAcceso')} />
          </View>
        ) : session && screen === 'NuevaContrasena' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Crea una contraseña nueva</Text>
            <Text style={styles.muted}>Tu correo ya está verificado. Elige una contraseña única de al menos 12 caracteres.</Text>
            <TextInput style={styles.input} placeholder="Nueva contraseña"
              accessibilityLabel="Nueva contraseña"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.input} placeholder="Confirmar nueva contraseña"
              accessibilityLabel="Confirmar contraseña nueva"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
            <Btn title={recoveryBusy ? 'Guardando...' : 'Guardar nueva contraseña'}
              disabled={recoveryBusy} onPress={saveNewPassword} />
            <Text style={styles.muted}>Nunca compartas tu código ni contraseña con otras personas.</Text>
          </View>
        ) : !session ? (
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
            <Btn title="¿Olvidaste tu contraseña?" secondary disabled={authBusy}
              onPress={() => { setRecoveryEmail(email.trim().toLowerCase()); setScreen('RecuperarAcceso'); }} />
            <Text style={styles.muted}>Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.</Text>
          </View>
        ) : (
          <>
            {screen !== 'Inicio' && <Btn title="← Volver al inicio" secondary onPress={() => navigate('Inicio')} disabled={busy} />}
            {screen === 'Inicio' && <>
              <View style={styles.hero}>
                <View style={styles.heroTopLine}>
                  <Text style={styles.heroEyebrow}>BILLETERA MUNDIAL</Text>
                  <Text style={styles.heroBadge}>MWD · PRUEBA</Text>
                </View>
                <Text style={styles.balanceCaption}>Saldo disponible</Text>
                <Text style={styles.balance}>{wallet ? formatMWD(wallet.balance_cents) : 'Consultando...'}</Text>
                <Text style={styles.balanceUnit}>MWD · créditos ficticios</Text>
                <View style={styles.heroDivider} />
                <Text style={styles.walletLabel}>TU IDENTIFICADOR DE BILLETERA</Text>
                <Text selectable style={styles.heroCode}>{wallet?.account_code || 'Preparando cuenta'}</Text>
                <Btn title="Compartir código para recibir" secondary
                  onPress={() => shareDemoCode('wallet', wallet?.account_code)} disabled={!wallet} />
              </View>
              <Text style={styles.sectionEyebrow}>MOVIMIENTOS</Text>
              <Text style={styles.sectionTitle}>¿Qué quieres hacer hoy?</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enviar MWD de demostración"
                  style={styles.quickAction} onPress={() => navigate('Transferir')} disabled={!wallet}>
                  <Text style={styles.quickIcon}>⇄</Text><Text style={styles.quickText}>Enviar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Recibir MWD de demostración"
                  style={styles.quickAction} onPress={() => navigate('Cuenta')}>
                  <Text style={styles.quickIcon}>↓</Text><Text style={styles.quickText}>Recibir</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pagar a un comercio de demostración"
                  style={styles.quickAction} onPress={() => navigate('PagarComercio')}>
                  <Text style={styles.quickIcon}>◇</Text><Text style={styles.quickText}>Pagar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver actividad"
                  style={styles.quickAction} onPress={() => navigate('Historial')}>
                  <Text style={styles.quickIcon}>≡</Text><Text style={styles.quickText}>Actividad</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionEyebrow}>SERVICIOS</Text>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Más opciones</Text>
                <Btn title="Aportaciones de demostración" secondary onPress={() => navigate('Aportar')} disabled={!wallet} />
                <Btn title="Mi comercio y solicitudes de cobro" secondary onPress={() => navigate('Comercio')} />
                <Btn title={syncing ? 'Actualizando cuenta...' : 'Actualizar saldo e historial'} secondary
                  onPress={() => refreshAccount()} disabled={syncing} />
                <Btn title="Administración" secondary onPress={() => navigate('Admin')} />
              </View>
              <View style={styles.accountStrip}>
                <Text style={styles.accountText} numberOfLines={1}>{session.user.email}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
                  <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
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
                <Btn title="Compartir código de cobro" secondary
                  onPress={() => shareDemoCode('payment', request.id)} />
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
              <Btn title="Compartir código de billetera" secondary
                onPress={() => shareDemoCode('wallet', wallet?.account_code)} disabled={!wallet} />
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

// Identidad visual 2.0: azul marino profundo, turquesa y dorado sobrio.
// Interfaz estática sin animaciones. Todos los saldos siguen siendo ficticios.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071321' },
  body: { paddingHorizontal: 18, paddingTop: 38, paddingBottom: 66, maxWidth: 620, width: '100%', alignSelf: 'center' },
  brandHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  brandIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#114858', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#3ED4C5' },
  brandIconText: { fontSize: 27, color: '#D5B57A', fontWeight: '700' },
  brandWords: { flex: 1 },
  logo: { color: '#FFFFFF', fontSize: 18, letterSpacing: 0.8, fontWeight: '800' },
  sub: { color: '#A9BCCB', marginTop: 3, fontSize: 12 },
  versionPill: { borderWidth: 1, borderColor: '#4C6878', borderRadius: 9, paddingVertical: 5, paddingHorizontal: 9 },
  versionText: { color: '#C6DDE0', fontSize: 12, fontWeight: '700' },
  demoBanner: { padding: 12, backgroundColor: '#263323', borderRadius: 11, borderWidth: 1, borderColor: '#6B653A', marginBottom: 17 },
  demoBannerText: { color: '#F3D49A', textAlign: 'center', fontWeight: '700', letterSpacing: 0.5, fontSize: 11 },
  warning: { color: '#F3D49A', textAlign: 'center', marginVertical: 19, fontSize: 12 },
  hero: { backgroundColor: '#123849', borderRadius: 23, padding: 22, marginBottom: 25, borderWidth: 1, borderColor: '#286B78' },
  heroTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 29 },
  heroEyebrow: { color: '#D6EAEC', fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  heroBadge: { color: '#061E23', backgroundColor: '#7FE0CA', paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', borderRadius: 12, fontSize: 10, fontWeight: '800' },
  balanceCaption: { color: '#C2DBE2', fontSize: 14 },
  balance: { color: '#FFFFFF', fontSize: 39, fontWeight: '800', marginTop: 5, letterSpacing: -1.1 },
  balanceUnit: { color: '#BBD0D7', marginTop: 5, marginBottom: 12, fontSize: 13 },
  heroDivider: { borderBottomColor: '#517585', borderBottomWidth: 1, marginVertical: 17 },
  walletLabel: { color: '#C1D6DB', fontSize: 10, letterSpacing: 0.8, fontWeight: '700' },
  heroCode: { color: '#FFFFFF', fontSize: 16, marginTop: 8, marginBottom: 17, fontWeight: '700', letterSpacing: 0.2 },
  sectionEyebrow: { color: '#7FE0CA', fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: 6 },
  sectionTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  quickAction: { width: '23.5%', backgroundColor: '#122C3D', borderRadius: 15, paddingVertical: 17, paddingHorizontal: 3, alignItems: 'center', borderWidth: 1, borderColor: '#2A5260' },
  quickIcon: { color: '#8FE6D4', fontSize: 27, marginBottom: 8, fontWeight: '600' },
  quickText: { color: '#EAF6F6', fontSize: 12, fontWeight: '700' },
  panel: { backgroundColor: '#10293A', borderWidth: 1, borderColor: '#25495A', borderRadius: 17, padding: 16, marginBottom: 17 },
  panelTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  accountStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  accountText: { color: '#A6BCCC', flex: 1, marginRight: 9, fontSize: 12 },
  logoutButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1F3A48' },
  logoutText: { color: '#D3E2E6', fontSize: 12, fontWeight: '700' },
  loadingText: { color: '#DFEEEE', textAlign: 'center', marginVertical: 28, fontSize: 15 },
  card: { backgroundColor: '#10293A', borderRadius: 17, padding: 20, marginBottom: 17, borderWidth: 1, borderColor: '#25495A' },
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginBottom: 13 },
  muted: { color: '#ABBECC', lineHeight: 21, marginBottom: 9 },
  small: { color: '#D4E0E7', marginTop: 6 },
  code: { color: '#8FE6D4', fontSize: 16, marginTop: 12, fontWeight: '700' },
  input: { backgroundColor: '#1C3A4E', color: '#FFFFFF', padding: 14, borderRadius: 11, marginVertical: 8, fontSize: 16 },
  button: { backgroundColor: '#15887F', padding: 16, borderRadius: 11, marginBottom: 12, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#284658' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  entry: { backgroundColor: '#10293A', padding: 17, borderRadius: 13, marginBottom: 12 },
  itemHeading: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  amount: { color: '#FFFFFF', fontSize: 18, marginVertical: 8 },
  footer: { color: '#92AABB', textAlign: 'center', fontSize: 11, marginTop: 30 },
});
