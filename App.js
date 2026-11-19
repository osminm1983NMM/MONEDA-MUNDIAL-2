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
  StyleSheet, Alert, Platform, StatusBar, ActivityIndicator, Linking
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
    flowType: 'pkce',
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
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeBusy, setPasswordChangeBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const passwordChangeBusyRef = useRef(false);
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
  const operationRevisionRef = useRef(0);
  const swapConfirmBusyRef = useRef(false);
  const swapQuoteBusyRef = useRef(false);
  const swapQuoteRevisionRef = useRef(0);
  const accountRefreshRevisionRef = useRef(0);
  const swapWalletRevisionRef = useRef(0);
  const pickupOrdersRevisionRef = useRef(0);
  const pickupCreateBusyRef = useRef(false);
  const pickupCancelBusyRef = useRef(false);
  const pickupCreateRevisionRef = useRef(0);
  const pickupCancelRevisionRef = useRef(0);
  const pendingRef = useRef(null);
  const pendingLoadedUserRef = useRef(null);
  const pendingRecoveryErrorRef = useRef(false);
  const pickupPendingRef = useRef(null);
  const userId = session?.user?.id;
  // Updated on every render: async callbacks must not compare against their stale closure.
  const currentUserIdRef = useRef(userId);
  currentUserIdRef.current = userId;

  useEffect(() => {
    let active = true;
    const processingRecoveryUrls = new Set();
    const processRecoveryUrl = async url => {
      if (!url || !url.startsWith('monedamundial://auth/recovery')) return;
      const callbackPath = url.split(/[?#]/)[0];
      if (callbackPath !== 'monedamundial://auth/recovery') return;
      const fragment = url.split('#')[1] || '';
      const query = url.split('?')[1]?.split('#')[0] || '';
      const params = new URLSearchParams(query);
      const fragmentParams = new URLSearchParams(fragment);
      for (const [key, value] of fragmentParams.entries()) params.set(key, value);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const authCode = params.get('code');
      // A recovery callback must explicitly identify its purpose. A generic
      // auth code must never activate the password-reset screen.
      if (params.get('type') !== 'recovery') return;
      if (params.get('error') || (!authCode && (!accessToken || !refreshToken))) {
        if (active) message('Recuperar contraseña', 'El enlace no contiene una sesión válida. Solicita otro correo.');
        return;
      }
      if (processingRecoveryUrls.has(url)) return;
      processingRecoveryUrls.add(url);
      try {
        const { error } = authCode
          ? await supabase.auth.exchangeCodeForSession(authCode)
          : await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
        if (error) throw error;
        if (active) {
          setRecoveryMode(true);
          setScreen('Cuenta');
        }
      } catch (_error) {
        if (active) message('Recuperar contraseña', 'No se pudo abrir el enlace. Solicita uno nuevo.');
      } finally {
        processingRecoveryUrls.delete(url);
      }
    };
    Linking.getInitialURL().then(processRecoveryUrl).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      processRecoveryUrl(url);
    });
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        // An auth event is more recent than the initial session lookup.
        if (active && !receivedAuthEvent) setSession(data.session);
      })
      .catch(error => { if (active && !receivedAuthEvent) message('Sesión', error.message); })
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      receivedAuthEvent = true;
      setSession(nextSession);
      setAuthLoading(false);
      // Token refreshes and user updates must not interrupt an unfinished flow.
      // Only explicit sign-in/sign-out changes the visible screen.
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setScreen('Cuenta');
      } else if (event === 'SIGNED_OUT') {
        setRecoveryMode(false);
        setScreen('Inicio');
      } else if (event === 'SIGNED_IN') {
        // A recovery link can emit SIGNED_IN before its callback finishes.
        // Do not override the password-change screen while recovering.
        setScreen(previous => previous === 'Cuenta' ? previous : 'Inicio');
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Never reuse a withdrawal request held in memory across account changes.
  useEffect(() => {
    pickupPendingRef.current = null;
    operationRevisionRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    pickupCreateRevisionRef.current += 1;
    pickupCancelRevisionRef.current += 1;
    pickupCreateBusyRef.current = false;
    pickupCancelBusyRef.current = false;
    setPickupBusy(false);
    setPickupCancelBusy(false);
    accountRefreshRevisionRef.current += 1;
    swapWalletRevisionRef.current += 1;
    pickupOrdersRevisionRef.current += 1;
    setSwapBusy(false);
    setPickupOrdersBusy(false);
    setSyncing(false);
    setSyncNotice('');
    swapQuoteRevisionRef.current += 1;
    swapQuoteBusyRef.current = false;
    swapConfirmBusyRef.current = false;
    setSwapQuote(null);
    setPickupAmount('');
    setPickupResult(null);
    setPickupOrders([]);
    setNewPassword('');
    setPasswordChangeBusy(false);
    passwordChangeBusyRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      setSwapWallet(null);
      setSwapQuote(null);
      return;
    }
    refreshAccount(userId);
  }, [userId]);

  useEffect(() => {
    let active = true;
    pendingLoadedUserRef.current = null;
    pendingRecoveryErrorRef.current = false;
    pendingRef.current = null;
    setAmount('');
    setRecipientCode('');
    if (!userId) return () => { active = false; };
    const key = 'mwd_demo_operation_pending_' + userId;
    AsyncStorage.getItem(key).then(saved => {
      if (!active) return;
      if (saved) {
        const p = JSON.parse(saved);
        if (!p || !['transfer', 'contribution'].includes(p.type) ||
            !Number.isSafeInteger(p.cents) || p.cents < 1 || p.cents > LIMIT_CENTS ||
            typeof p.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id) || typeof p.code !== 'string' ||
            (p.type === 'transfer' && !/^MWD-[A-F0-9]{16}$/.test(p.code)) ||
            (p.type === 'contribution' && p.code !== '')) {
          throw new Error('Solicitud pendiente inválida');
        }
        pendingRef.current = p;
        setAmount(formatMWD(p.cents));
        setRecipientCode(p.code);
        message('Operación pendiente',
          'Se recuperó una solicitud anterior. Confirma su estado antes de enviar otra.');
      }
      pendingRecoveryErrorRef.current = false;
      pendingLoadedUserRef.current = userId;
    }).catch(() => {
      if (active) pendingRecoveryErrorRef.current = true;
      if (active) message('Recuperación',
        'No fue posible leer la solicitud pendiente. No envíes otra hasta revisar la conexión y el almacenamiento.');
    });
    return () => { active = false; };
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!id) return;
    const refreshRevision = ++accountRefreshRevisionRef.current;
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
      const { data: currentSession, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (refreshRevision !== accountRefreshRevisionRef.current ||
          id !== currentUserIdRef.current ||
          id !== currentSession.session?.user?.id) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
      setSyncNotice('Saldo e historial actualizados correctamente.');
    } catch (error) {
      if (refreshRevision === accountRefreshRevisionRef.current && id === currentUserIdRef.current) {
        setSyncNotice('No se pudo actualizar. Revisa el mensaje de error.');
        message('Sincronización', error.message || 'No se pudo consultar Supabase.');
      }
    } finally {
      if (refreshRevision === accountRefreshRevisionRef.current && id === currentUserIdRef.current) setSyncing(false);
    }
  }

  async function authenticate(action) {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return message('Correo', 'Introduce un correo válido.');
    if (password.length < (action === 'register' ? 12 : 8)) {
      return message('Contraseña', action === 'register'
        ? 'Para crear una cuenta, utiliza al menos 12 caracteres.'
        : 'Introduce la contraseña de tu cuenta.');
    }
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

  async function requestPasswordReset() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return message('Recuperar contraseña', 'Introduce primero el correo de tu cuenta.');
    }
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'monedamundial://auth/recovery',
      });
      if (error) throw error;
      message('Recuperar contraseña',
        'Si el correo corresponde a una cuenta, revisa tu bandeja de entrada y sigue las instrucciones. No compartas el enlace.');
    } catch (error) {
      message('Recuperar contraseña', error.message || 'No fue posible solicitar la recuperación.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function changeSignedInPassword() {
    if (!userId || passwordChangeBusyRef.current) return;
    if (newPassword.length < 12) {
      return message('Nueva contraseña', 'Utiliza al menos 12 caracteres.');
    }
    passwordChangeBusyRef.current = true;
    setPasswordChangeBusy(true);
    const requestedUserId = userId;
    try {
      const { data, error: sessionError } = await supabase.auth.getUser();
      if (sessionError) throw sessionError;
      if (data.user?.id !== requestedUserId || requestedUserId !== currentUserIdRef.current) {
        throw new Error('La sesión cambió. Vuelve a iniciar sesión.');
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (requestedUserId === currentUserIdRef.current) {
        setNewPassword('');
        setRecoveryMode(false);
        message('Contraseña actualizada', 'Tu contraseña fue cambiada correctamente.');
      }
    } catch (error) {
      if (requestedUserId === currentUserIdRef.current) {
        message('Cambiar contraseña', error.message || 'No se pudo actualizar la contraseña.');
      }
    } finally {
      if (requestedUserId === currentUserIdRef.current) {
        passwordChangeBusyRef.current = false;
        setPasswordChangeBusy(false);
      }
    }
  }

  function changeAmount(value) {
    if (pendingRef.current) {
      return message('Solicitud pendiente',
        'Primero confirma o reintenta la operación original. No cambies el importe mientras su resultado sea incierto.');
    }
    setAmount(value);
  }
  function changeRecipient(value) {
    if (pendingRef.current) {
      return message('Solicitud pendiente',
        'Primero confirma o reintenta la operación original. No cambies el destinatario mientras su resultado sea incierto.');
    }
    setRecipientCode(value);
  }

  async function loadPendingOperation() {
    if (!userId) throw new Error('Inicia sesión para recuperar la solicitud.');
    const key = 'mwd_demo_operation_pending_' + userId;
    if (pendingRecoveryErrorRef.current) {
      throw new Error('La recuperación local falló. No se enviará una nueva operación hasta poder leer las solicitudes pendientes.');
    }
    if (pendingLoadedUserRef.current !== userId) {
      const saved = await AsyncStorage.getItem(key);
      if (saved) {
        const candidate = JSON.parse(saved);
        if (!candidate || !['transfer', 'contribution'].includes(candidate.type) ||
            !Number.isSafeInteger(candidate.cents) || candidate.cents < 1 ||
            candidate.cents > LIMIT_CENTS || typeof candidate.id !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id) ||
            typeof candidate.code !== 'string' ||
            (candidate.type === 'transfer' && !/^MWD-[A-F0-9]{16}$/.test(candidate.code)) ||
            (candidate.type === 'contribution' && candidate.code !== '')) {
          throw new Error('Solicitud guardada inválida. Requiere revisión antes de enviar otra.');
        }
        pendingRef.current = candidate;
        setAmount(formatMWD(candidate.cents));
        setRecipientCode(candidate.code);
      }
      pendingLoadedUserRef.current = userId;
    }
    return key;
  }

  async function executeOperation(type, cents, code = '') {
    if (busyRef.current) return;
    busyRef.current = true;
    const operationRevision = ++operationRevisionRef.current;
    const operationUserId = userId;
    const isCurrentOperation = () => operationRevision === operationRevisionRef.current &&
      operationUserId === currentUserIdRef.current;
    setBusy(true);
    try {
      const storageKey = await loadPendingOperation();
      if (!isCurrentOperation()) return;
      const pending = pendingRef.current;
      if (pending && (pending.type !== type || pending.cents !== cents || pending.code !== code)) {
        throw new Error('Existe una solicitud pendiente. Reintenta con el tipo, importe y destinatario originales.');
      }
      if (!pending) {
        pendingRef.current = { type, cents, code, id: uniqueRequestId() };
      }
      // Persist BEFORE calling the server: timeout and app restart must reuse this ID.
      await AsyncStorage.setItem(storageKey, JSON.stringify(pendingRef.current));
      if (!isCurrentOperation()) return;
      const requestId = pendingRef.current.id;
      // A retry after a lost response must first ask whether the original was posted.
      // Never create a new request ID merely because this status check fails.
      if (pending) {
        const check = await supabase.rpc('mwd_operation_status_demo', {
          p_request_id: requestId,
        });
        if (!isCurrentOperation()) return;
        if (check.error) throw check.error;
        if (check.data?.status === 'processed') {
          if (check.data.kind !== type || check.data.amountCents !== cents ||
              (type === 'transfer' && check.data.recipientCode !== code)) {
            throw new Error('La operación original no coincide. Requiere revisión manual.');
          }
          try {
            await AsyncStorage.removeItem(storageKey);
            pendingRef.current = null;
          } catch (_cleanupError) {
            pendingRecoveryErrorRef.current = true;
          }
          setAmount('');
          setRecipientCode('');
          setScreen('Inicio');
          message('Operación ficticia confirmada',
            'El servidor confirmó que la solicitud original ya estaba registrada.');
          refreshAccount().catch(() => {});
          return;
        }
        if (check.data?.status !== 'unconfirmed') {
          throw new Error('El estado de la operación no es verificable.');
        }
      }
      const response = type === 'transfer'
        ? await supabase.rpc('mwd_transfer_demo', {
          p_recipient_code: code, p_amount_cents: cents, p_request_id: requestId,
        })
        : await supabase.rpc('mwd_contribute_demo', {
          p_amount_cents: cents, p_request_id: requestId,
        });
      if (!isCurrentOperation()) return;
      if (response.error) throw response.error;
      if (!['ok', 'already_processed'].includes(response.data?.status)) {
        throw new Error('La operación no pudo ser confirmada.');
      }
      // Server success is definitive. Local cleanup may fail independently.
      // Keep the persisted UUID if cleanup fails; a later retry will query status.
      try {
        await AsyncStorage.removeItem(storageKey);
        pendingRef.current = null;
      } catch (_cleanupError) {
        pendingRecoveryErrorRef.current = true;
      }
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      // The server has confirmed the operation; a failed screen refresh must not
      // reclassify it as an unconfirmed transfer or trigger another RPC.
      refreshAccount().catch(() => {});
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
    } catch (error) {
      // A timeout does not prove that the server rolled back the operation.
      // Check the original request before suggesting a retry.
      if (!isCurrentOperation()) return;
      const pending = pendingRef.current;
      let verified = false;
      if (pending) {
        try {
          const status = await supabase.rpc('mwd_operation_status_demo', {
            p_request_id: pending.id,
          });
          if (!isCurrentOperation()) return;
          if (!status.error && status.data?.status === 'processed' &&
              status.data.kind === pending.type &&
              status.data.amountCents === pending.cents &&
              (pending.type !== 'transfer' || status.data.recipientCode === pending.code)) {
            verified = true;
            try {
              await AsyncStorage.removeItem('mwd_demo_operation_pending_' + userId);
              pendingRef.current = null;
            } catch (_cleanupError) {
              pendingRecoveryErrorRef.current = true;
            }
            setAmount('');
            setRecipientCode('');
            setScreen('Inicio');
            refreshAccount().catch(() => {});
            message('Operación ficticia confirmada',
              'El servidor confirmó que la solicitud original ya estaba registrada.');
          }
        } catch (_statusError) {
          // Keep the request ID: a failed status lookup is not proof of failure.
        }
      }
      if (!verified) {
        message('Operación no confirmada',
          (error.message || 'Error desconocido') +
          '\nConserva la solicitud original. No cambies el importe ni el destinatario; vuelve a consultar o reintenta con los mismos datos.');
      }
    } finally {
      if (isCurrentOperation()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function prepareOperation(type) {
    if (busyRef.current) return;
    const cents = amountToCents(amount);
    if (cents === null) {
      return message('Cantidad inválida', 'Introduce un importe positivo, máximo 1,000,000 MWD y dos decimales.');
    }
    if (!wallet) return message('Espera', 'Primero carga tu cuenta.');
    if (pendingRecoveryErrorRef.current) {
      return message('Recuperación pendiente', 'No es seguro enviar una nueva operación hasta recuperar el almacenamiento local.');
    }
    if (pendingLoadedUserRef.current !== userId) {
      return message('Verificando solicitudes', 'Espera a que termine la recuperación de operaciones pendientes.');
    }
    const code = type === 'transfer' ? recipientCode.trim().toUpperCase() : '';
    const pending = pendingRef.current;
    if (pending && (pending.type !== type || pending.cents !== cents || pending.code !== code)) {
      return message('Solicitud pendiente', 'Primero resuelve la operación anterior con sus datos originales.');
    }
    // A completed but unacknowledged transfer may already have reduced the balance.
    // Let the server check the original idempotency key before rejecting a retry.
    if (!pending && cents > wallet.balance_cents) {
      return message('Saldo insuficiente', 'No tienes suficientes MWD ficticios.');
    }
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
    const revision = ++swapWalletRevisionRef.current;
    const requestedUserId = userId;
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (error) throw error;
      if (revision === swapWalletRevisionRef.current && requestedUserId === currentUserIdRef.current) setSwapWallet(data);
    } catch (error) {
      if (revision === swapWalletRevisionRef.current && requestedUserId === currentUserIdRef.current) message('Monedas de prueba', error.message || 'No se pudo cargar la billetera.');
    } finally {
      if (revision === swapWalletRevisionRef.current && requestedUserId === currentUserIdRef.current) setSwapBusy(false);
    }
  }

  async function requestSwapQuote() {
    if (swapBusy || swapQuoteBusyRef.current || swapConfirmBusyRef.current) return;
    const normalized = swapAmount.trim().replace(',', '.');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
      return message('Cantidad inválida', 'Usa hasta seis decimales.');
    }
    const [whole, fraction = ''] = normalized.split('.');
    const micro = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
    if (!Number.isSafeInteger(micro) || micro < 1000000 || micro > 10000000000) {
      return message('Cantidad inválida', 'Introduce entre 1 y 10,000 unidades de prueba.');
    }
    swapQuoteBusyRef.current = true;
    const quoteRevision = ++swapQuoteRevisionRef.current;
    const quoteUserId = userId;
    setSwapBusy(true);
    setSwapQuote(null);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_quote_demo', {
        p_from_asset: swapFrom, p_amount_micro: micro, p_client_request_id: uniqueRequestId(),
      });
      if (error) throw error;
      // Ignore responses for an amount, asset or account that has since changed.
      if (quoteRevision === swapQuoteRevisionRef.current && quoteUserId === currentUserIdRef.current) {
        setSwapQuote(data);
      }
    } catch (error) {
      if (quoteRevision === swapQuoteRevisionRef.current && quoteUserId === currentUserIdRef.current) {
        message('Cotización', error.message || 'No se pudo cotizar.');
      }
    } finally {
      // An obsolete quote must never clear the busy state of a newer request.
      if (quoteRevision === swapQuoteRevisionRef.current &&
          quoteUserId === currentUserIdRef.current) {
        swapQuoteBusyRef.current = false;
        setSwapBusy(false);
      }
    }
  }

  async function confirmSwap() {
    if (!swapQuote?.quoteId || swapBusy || swapConfirmBusyRef.current || swapQuoteBusyRef.current) return;
    const quote = swapQuote;
    const confirmRevision = swapQuoteRevisionRef.current;
    const confirmUserId = userId;
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      setSwapQuote(null);
      return message('Cotización vencida', 'Solicita una cotización nueva.');
    }
    swapConfirmBusyRef.current = true;
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_confirm_demo', {
        p_quote_id: quote.quoteId,
      });
      if (error) throw error;
      if (!['ok', 'already_processed'].includes(data?.status)) throw new Error('Confirmación no reconocida.');
      // Do not let an old account's confirmation overwrite a new account's form.
      if (confirmRevision !== swapQuoteRevisionRef.current || confirmUserId !== currentUserIdRef.current) return;
      setSwapQuote(null);
      setSwapAmount('');
      // A successful confirmation is final even when refreshing balances fails.
      message('Conversión ficticia', 'Operación registrada correctamente. Actualiza los saldos para verificarla.');
      try {
        const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo');
        if (walletResponse.error) throw walletResponse.error;
        if (confirmRevision === swapQuoteRevisionRef.current && confirmUserId === currentUserIdRef.current) {
          setSwapWallet(walletResponse.data);
        }
      } catch (_refreshError) {
        // Never present a completed conversion as a failed confirmation.
      }
    } catch (error) {
      if (confirmRevision === swapQuoteRevisionRef.current && confirmUserId === currentUserIdRef.current) {
        message('Conversión no confirmada', (error.message || 'Error desconocido') +
          '\nConsulta los saldos antes de intentar otra conversión.');
      }
    } finally {
      // Keep the newer account's loading state untouched.
      if (confirmRevision === swapQuoteRevisionRef.current &&
          confirmUserId === currentUserIdRef.current) {
        swapConfirmBusyRef.current = false;
        setSwapBusy(false);
      }
    }
  }

  async function createDemoPickup() {
    if (pickupBusy || pickupCreateBusyRef.current) return;
    const cents = amountToCents(pickupAmount);
    if (cents === null || cents < 100 || cents > 100000) {
      return message('Monto inválido', 'Usa entre 1.00 y 1000.00 MWD ficticios.');
    }
    pickupCreateBusyRef.current = true;
    const createRevision = ++pickupCreateRevisionRef.current;
    const createUserId = userId;
    setPickupBusy(true);
    setPickupResult(null);
    try {
      // Keep the same request ID after app restarts or network timeouts.
      // Scope the saved request to the signed-in user to avoid cross-account reuse.
      if (!userId) throw new Error('Inicia sesión antes de crear una orden.');
      const storageKey = 'mwd_demo_pickup_pending_' + userId;
      const stored = await AsyncStorage.getItem(storageKey);
      const previous = stored ? JSON.parse(stored) : pickupPendingRef.current;
      if (previous && (!Number.isSafeInteger(previous.cents) ||
          previous.cents < 100 || previous.cents > 100000 ||
          typeof previous.id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previous.id))) {
        throw new Error('Solicitud de retiro guardada inválida. Requiere revisión antes de reintentar.');
      }
      if (previous && previous.cents !== cents) {
        if (createRevision === pickupCreateRevisionRef.current && createUserId === currentUserIdRef.current) setPickupAmount(formatMWD(previous.cents));
        throw new Error('Hay una orden sin confirmar por ' + formatMWD(previous.cents) +
          ' MWD. Se restauró su importe original; consulta Mis retiros y reintenta únicamente esa solicitud.');
      }
      const pending = previous || { cents, id: uniqueRequestId() };
      if (createRevision !== pickupCreateRevisionRef.current || createUserId !== currentUserIdRef.current) return;
      pickupPendingRef.current = pending;
      await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
      if (createRevision !== pickupCreateRevisionRef.current || createUserId !== currentUserIdRef.current) return;
      const requestId = pending.id;
      const { data, error } = await supabase.rpc('mwd_pickup_create_demo', {
        p_destination_country: 'HN', p_amount_cents: cents, p_request_id: requestId,
      });
      if (error) throw error;
      if (!['created', 'already_created'].includes(data?.status)) throw new Error('Respuesta inesperada.');
      // Once the server confirms creation, cleanup failures must not make the
      // application report an unconfirmed order or invite another request.
      if (createRevision === pickupCreateRevisionRef.current && createUserId === currentUserIdRef.current) {
        setPickupResult(data);
        pickupPendingRef.current = null;
        setPickupAmount('');
      }
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch (_cleanupError) {
        // A later retry reuses the saved UUID and receives already_created.
      }
    } catch (error) {
      if (createRevision === pickupCreateRevisionRef.current && createUserId === currentUserIdRef.current) message('Estado del retiro no confirmado', (error.message || 'Error desconocido') + '\nLa orden podría haberse registrado. Conserva el importe original y consulta Mis retiros antes de reintentar.');
    } finally {
      if (createRevision === pickupCreateRevisionRef.current && createUserId === currentUserIdRef.current) {
        pickupCreateBusyRef.current = false;
        setPickupBusy(false);
      }
    }
  }

  async function loadPickupOrders() {
    const revision = ++pickupOrdersRevisionRef.current;
    const requestedUserId = userId;
    setPickupOrdersBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_my_orders_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de órdenes no reconocida.');
      if (revision === pickupOrdersRevisionRef.current && requestedUserId === currentUserIdRef.current) setPickupOrders(data);
    } catch (error) {
      if (revision === pickupOrdersRevisionRef.current && requestedUserId === currentUserIdRef.current) message('No se pudieron consultar las órdenes', error.message || 'Error desconocido');
    } finally {
      if (revision === pickupOrdersRevisionRef.current && requestedUserId === currentUserIdRef.current) setPickupOrdersBusy(false);
    }
  }

  async function cancelDemoPickup(orderId) {
    if (pickupCancelBusy || pickupCancelBusyRef.current) return;
    pickupCancelBusyRef.current = true;
    const cancelRevision = ++pickupCancelRevisionRef.current;
    const cancelUserId = userId;
    setPickupCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_cancel_demo', { p_order_id: orderId });
      if (error) throw error;
      if (!['cancelled', 'already_cancelled'].includes(data?.status)) throw new Error('Respuesta de cancelación no reconocida.');
      if (cancelRevision !== pickupCancelRevisionRef.current || cancelUserId !== currentUserIdRef.current) return;
      message('Orden ficticia', data.status === 'cancelled' ? 'Orden cancelada correctamente.' : 'La orden ya estaba cancelada.');
      await loadPickupOrders();
    } catch (error) {
      if (cancelRevision === pickupCancelRevisionRef.current && cancelUserId === currentUserIdRef.current) message('No se pudo cancelar', error.message || 'Error desconocido');
    } finally {
      if (cancelRevision === pickupCancelRevisionRef.current && cancelUserId === currentUserIdRef.current) {
        pickupCancelBusyRef.current = false;
        setPickupCancelBusy(false);
      }
    }
  }

  function navigate(to) {
    setScreen(to);
    if (to === 'Convertir') loadSwapWallet();
    if (to === 'MisRetiros') loadPickupOrders();
    // Navigation must not discard an unresolved idempotency key.
    // Keep the original amount and destination until the server confirms it.
    if (!pendingRef.current) {
      setAmount('');
      setRecipientCode('');
    }
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
              secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <Btn title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} secondary
              onPress={() => setShowPassword(value => !value)} disabled={authBusy} />
            <Btn title={authBusy ? 'Espera...' : 'Iniciar sesión'} onPress={() => authenticate('login')} disabled={authBusy} />
            <Btn title="Crear cuenta de prueba" secondary onPress={() => authenticate('register')} disabled={authBusy} />
            <Btn title="Olvidé mi contraseña" secondary onPress={requestPasswordReset} disabled={authBusy} />
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
                  <Text style={styles.small}>Monto: {formatMWD(order.amountCents)} MWD ficticios</Text>
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
              <Text style={styles.muted}>Monto de prueba: 1.00 a 1000.00 MWD</Text>
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
              {recoveryMode && <Text style={styles.warning}>Recuperación de cuenta: establece una contraseña nueva para terminar.</Text>}
              <Text style={styles.heading}>Mi identificador para recibir</Text>
              <Text selectable style={styles.code}>{wallet?.account_code}</Text>
              <Text style={styles.muted}>Comparte este identificador con otra cuenta de prueba. No compartas tu contraseña.</Text>
              <Text style={styles.small}>Correo: {session.user.email}</Text>
              <Text style={styles.heading}>Cambiar contraseña</Text>
              <TextInput style={styles.input} placeholder="Nueva contraseña (mínimo 12 caracteres)"
                placeholderTextColor="#9fb1c8" secureTextEntry autoCapitalize="none"
                autoCorrect={false} value={newPassword} onChangeText={setNewPassword} />
              <Btn title={passwordChangeBusy ? 'Actualizando...' : 'Guardar nueva contraseña'}
                secondary onPress={changeSignedInPassword} disabled={passwordChangeBusy} />
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
                  swapQuoteRevisionRef.current += 1;
                  setSwapFrom(swapFrom === 'COIN' ? 'STABLE' : 'COIN');
                  setSwapQuote(null);
                }} />
              <TextInput style={styles.input} placeholder="Cantidad (mínimo 1)"
                keyboardType="decimal-pad" placeholderTextColor="#9fb1c8"
                value={swapAmount} onChangeText={value => {
                  swapQuoteRevisionRef.current += 1;
                  setSwapAmount(value);
                  setSwapQuote(null);
                }} />
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
