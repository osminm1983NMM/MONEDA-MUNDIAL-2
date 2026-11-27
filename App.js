// MONEDA MUNDIAL 2.0 — DEMOSTRACIÓN CON SUPABASE
// Los MWD son créditos ficticios. Esta aplicación NO mueve dinero real.
// Copia este archivo COMPLETO en App.js de un Snack NUEVO (conserva la versión 1.3).
// Dependencias de Snack: @supabase/supabase-js, @react-native-async-storage/async-storage,
// react-native-url-polyfill, react-native-get-random-values.

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Linking,
  StyleSheet, Alert, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import NativeAsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createAuthStorage, createMemoryAuthStorage } from './auth-storage';
import { createClient } from '@supabase/supabase-js';
import PartnerRegistryScreen from './PartnerRegistryScreen';
import RemittanceQuoteScreen from './RemittanceQuoteScreen';

// Solo referencias de operaciones DEMO: orden FIFO por clave, incluso si cambia la sesión.
// Las claves de autenticación de Supabase conservan su almacenamiento original.
function createPendingStorage(nativeStorage) {
  const queues = new Map();
  function enqueue(key, work) {
    const previous = queues.get(key) || Promise.resolve();
    const result = previous.then(work);
    // Un fallo se propaga a su solicitante, pero no bloquea las tareas siguientes.
    const tail = result.then(() => undefined, () => undefined);
    queues.set(key, tail);
    tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
    return result;
  }
  return {
    getItem: key => enqueue(key, () => nativeStorage.getItem(key)),
    setItem: (key, value) => enqueue(key, () => nativeStorage.setItem(key, value)),
    removeItem: key => enqueue(key, () => nativeStorage.removeItem(key)),
  };
}
const AsyncStorage = createPendingStorage(NativeAsyncStorage);

// CLAVE PUBLICABLE de Supabase. Nunca coloques claves secret/service_role en App.js.
const SUPABASE_URL = 'https://egrsdrlpavrtbgxoyxvg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sKotmweOAug6XqTR16U9Wg_ugxAx3vm';
// GitHub Actions sustituye este marcador exclusivamente al compilar LAB.
const BUILD_COMMIT = 'sin verificar';
const PASSWORD_RESET_REDIRECT = 'com.monedamundial.app://auth/reset-password';
// Native auth tokens and PKCE verifiers never fall back to plaintext storage.
// Web DEMO uses volatile storage; persistent sessions are Android-only in this release.
const AUTH_STORAGE_KEY = 'sb-egrsdrlpavrtbgxoyxvg-auth-token';
const authStorage = Platform.OS === 'web' ? createMemoryAuthStorage() : createAuthStorage(SecureStore, NativeAsyncStorage, AUTH_STORAGE_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

const LIMIT_CENTS = 100000000; // 1 millón de MWD por operación ficticia
const formatMWD = cents => (Number(cents || 0) / 100).toFixed(2);

function pickupStatusLabel(status) {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'cancelled': return 'Cancelada';
    case 'expired': return 'Vencida';
    case 'simulated_collected': return 'Retirada (simulación)';
    default: return 'Estado no reconocido';
  }
}

function syncErrorMessage(error) {
  const detail = typeof error?.message === 'string' ? error.message.trim() : '';
  if (/^(?:TypeError:\s*)?(?:Network request failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/i.test(detail)) {
    return 'No hay conexión con el servidor. Revisa tu conexión a internet y vuelve a pulsar Actualizar saldo e historial. Los datos visibles pueden estar desactualizados.';
  }
  return detail || 'No se pudo consultar Supabase.';
}

function pendingOperationStorageKey(userId) {
  return 'mwd_pending_operation:' + userId;
}

function pendingPickupStorageKey(userId) {
  return 'mwd_pending_pickup:' + userId;
}

function parsePendingOperation(saved, userId) {
  const pending = JSON.parse(saved);
  if (!pending || pending.userId !== userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.id || '') ||
      !['transfer', 'contribution'].includes(pending.type) ||
      !Number.isSafeInteger(pending.cents) || pending.cents < 1 || pending.cents > LIMIT_CENTS ||
      (pending.type === 'transfer' ? !/^MWD-[A-F0-9]{16}$/.test(pending.code || '') : pending.code !== '')) {
    throw new Error('La solicitud guardada no tiene un formato válido.');
  }
  return pending;
}

function parsePendingPickup(saved, userId) {
  const pending = JSON.parse(saved);
  if (!pending || pending.userId !== userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.id || '') ||
      pending.destinationCountry !== 'HN' || !Number.isSafeInteger(pending.cents) ||
      pending.cents < 100 || pending.cents > 100000) {
    throw new Error('La solicitud de retiro guardada no tiene un formato válido.');
  }
  return pending;
}

function isDefinitiveRpcRejection(error, status) {
  // Keep idempotency conflicts and reconciliation cases for review; network errors stay pending.
  const messageText = String(error?.message || '');
  const requiresReview = /identificador\s+(?:ya usado|reutilizado)|solicitud duplicada inconsistente|reconciliaci[oó]n/i.test(messageText);
  return status === 400 && ['22023', 'P0001', '42501'].includes(error?.code) && !requiresReview;
}

function amountToCents(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
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
  const [preparedUserId, setPreparedUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const authBusyRef = useRef(false);
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
  const [pendingPickup, setPendingPickup] = useState(null);
  const [pickupPendingError, setPickupPendingError] = useState('');
  const [pickupResult, setPickupResult] = useState(null);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [pickupOrdersBusy, setPickupOrdersBusy] = useState(false);
  const [pickupCancelBusy, setPickupCancelBusy] = useState(false);
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [pendingOperationRecoveryError, setPendingOperationRecoveryError] = useState('');
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const pickupPendingRef = useRef(null);
  const pickupBusyRef = useRef(false);
  const pickupOrdersBusyRef = useRef(false);
  const pickupCancelBusyRef = useRef(false);
  const currentUserRef = useRef(null);
  const confirmationRef = useRef(null);
  const refreshAccountVersionRef = useRef(0);
  const swapBusyTokenRef = useRef(null);
  const swapQuoteRef = useRef(null);
  const recoveryCodeStateRef = useRef({ inFlight: new Set(), processed: new Set() });
  const recoveryActorRef = useRef(null);
  const authEventUserRef = useRef(null);
  const userId = session?.user?.id;
  // Remount the scroll container only when account or screen changes.
  // This prevents the login form from inheriting a previous private screen offset.
  const scrollKey = userId ? 'account:' + userId + ':' + screen : 'login';
  // Actualizar durante render para invalidar respuestas de red de cuentas anteriores.
  if (currentUserRef.current !== userId) confirmationRef.current = null;
  currentUserRef.current = userId;
  swapQuoteRef.current = userId === preparedUserId ? swapQuote : null;
  const isCurrentUser = id => !!id && id === currentUserRef.current;
  // Las confirmaciones nativas pueden quedar abiertas después de cambiar de sesión.
  function confirmSessionAction(title, detail, action) {
    const actorId = userId;
    if (!isCurrentUser(actorId) || preparedUserId !== actorId || authBusyRef.current) return;
    const token = {};
    confirmationRef.current = token;
    confirmAction(title, detail, () => {
      if (confirmationRef.current !== token) return;
      confirmationRef.current = null;
      if (!isCurrentUser(actorId) || authBusyRef.current) return;
      action();
    });
  }
  function beginAuthBusy() {
    if (authBusyRef.current) return false;
    authBusyRef.current = true;
    confirmationRef.current = null;
    setAuthBusy(true);
    return true;
  }
  function endAuthBusy() {
    authBusyRef.current = false;
    setAuthBusy(false);
  }
  function beginSwapBusy() {
    if (swapBusyTokenRef.current) return null;
    const token = {};
    swapBusyTokenRef.current = token;
    setSwapBusy(true);
    return token;
  }
  function endSwapBusy(token, actorId) {
    if (swapBusyTokenRef.current !== token) return;
    swapBusyTokenRef.current = null;
    if (isCurrentUser(actorId)) setSwapBusy(false);
  }

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const handleAuthUrl = async url => {
      if (!url) return;
      let claimedCode = null;
      let ownsAuthBusy = false;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'com.monedamundial.app:' ||
            parsed.host !== 'auth' || parsed.pathname !== '/reset-password') return;
        const errorDescription = parsed.searchParams.get('error_description') ||
          parsed.searchParams.get('error');
        if (errorDescription) throw new Error('El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.');
        const code = parsed.searchParams.get('code');
        if (!code) throw new Error('El enlace no contiene un código de recuperación. Solicita uno nuevo.');
        const codeState = recoveryCodeStateRef.current;
        if (codeState.processed.has(code) || codeState.inFlight.has(code)) return;
        if (!beginAuthBusy()) {
          if (active) message('Enlace de acceso', 'Hay otra operación de acceso en curso. Abre el enlace de nuevo cuando termine.');
          return;
        }
        ownsAuthBusy = true;
        codeState.inFlight.add(code);
        claimedCode = code;
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw new Error('No se pudo verificar el enlace. Solicita uno nuevo desde este dispositivo.');
        if (data?.redirectType !== 'recovery') {
          throw new Error('El código no corresponde a recuperación de contraseña.');
        }
        const recoveredUser = data?.session?.user?.id;
        if (!recoveredUser || authEventUserRef.current !== recoveredUser) {
          throw new Error('La sesión de recuperación ya no está disponible. Solicita otro enlace.');
        }
        codeState.processed.add(code);
        if (codeState.processed.size > 5) {
          codeState.processed.delete(codeState.processed.values().next().value);
        }
        if (active) {
          recoveryActorRef.current = recoveredUser;
          setNewPassword('');
          setConfirmNewPassword('');
          setScreen('CambiarContraseña');
        }
      } catch (error) {
        if (active) message('Enlace de acceso', 'El enlace no pudo verificarse o ha vencido. Abre un enlace válido desde este dispositivo.');
      } finally {
        if (claimedCode) recoveryCodeStateRef.current.inFlight.delete(claimedCode);
        if (ownsAuthBusy && active) endAuthBusy();
      }
    };

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        // Una respuesta inicial tardía no debe sobrescribir una sesión más reciente.
        if (active && !authEventReceived) setSession(data.session);
      })
      .catch(() => { if (active) message('Sesión', 'No se pudo restaurar la sesión de forma segura. Intenta iniciar sesión nuevamente.'); })
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authEventReceived = true;
      const nextUser = nextSession?.user?.id || null;
      if (authEventUserRef.current !== nextUser || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') {
        confirmationRef.current = null;
      }
      authEventUserRef.current = nextUser;
      setSession(nextSession);
      setAuthLoading(false);
      if (event === 'PASSWORD_RECOVERY' && nextUser) {
        recoveryActorRef.current = nextUser;
        setNewPassword('');
        setConfirmNewPassword('');
        setScreen('CambiarContraseña');
      } else if (event === 'SIGNED_OUT' || !nextUser ||
                 (recoveryActorRef.current && recoveryActorRef.current !== nextUser)) {
        recoveryActorRef.current = null;
        setNewPassword('');
        setConfirmNewPassword('');
        setScreen('Inicio');
      } else if (event === 'SIGNED_IN' && recoveryActorRef.current !== nextUser) {
        setNewPassword('');
        setConfirmNewPassword('');
        setScreen('Inicio');
      }
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });
    Linking.getInitialURL().then(url => {
      if (active) void handleAuthUrl(url);
    }).catch(error => {
      if (active) message('Enlace de acceso', error.message || 'No se pudo abrir el enlace.');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // No reutilizar identificadores de operaciones entre cuentas diferentes.
    pendingRef.current = null;
    pickupPendingRef.current = null;
    pickupBusyRef.current = false;
    pickupOrdersBusyRef.current = false;
    pickupCancelBusyRef.current = false;
    busyRef.current = false;
    setBusy(false);
    // Invalidate in-flight refreshes and clear synchronization state on account changes.
    refreshAccountVersionRef.current += 1;
    setSyncing(false);
    setSyncNotice('');
    swapBusyTokenRef.current = null;
    setSwapBusy(false);
    setPickupBusy(false);
    setPickupOrdersBusy(false);
    setPickupCancelBusy(false);
    // Ocultar inmediatamente información de la cuenta anterior durante un cambio de usuario.
    setWallet(null);
    setOperations([]);
    setAdminRole(null);
    setSwapWallet(null);
    setSwapFrom('COIN');
    setSwapAmount('');
    swapQuoteRef.current = null;
    setSwapQuote(null);
    setPickupOrders([]);
    setPickupResult(null);
    setAmount('');
    setRecipientCode('');
    setPickupAmount('');
    setPendingOperation(null);
    setPendingOperationRecoveryError('');
    setPendingPickup(null);
    setPickupPendingError('');
    // Habilitar las pantallas privadas solo tras limpiar los datos de la cuenta anterior.
    setPreparedUserId(userId || null);
    if (!userId) {
      return;
    }
    refreshAccount(userId);
    recoverPendingOperation(userId);
    recoverPendingPickup(userId);
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!isCurrentUser(id)) return;
    const requestVersion = ++refreshAccountVersionRef.current;
    setSyncing(true);
    setSyncNotice('Actualizando...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const [w, h, a] = await Promise.all([
        supabase.from('mwd_wallets')
          .select('user_id,account_code,balance_cents')
          .eq('user_id', id).abortSignal(controller.signal).single(),
        supabase.from('mwd_operations')
          .select('id,kind,source_user_id,destination_user_id,amount_cents,created_at')
          .or(`source_user_id.eq.${id},destination_user_id.eq.${id}`)
          .order('created_at', { ascending: false }).limit(50).abortSignal(controller.signal),
        supabase.from('mwd_admin_roles').select('role').eq('user_id', id).abortSignal(controller.signal).maybeSingle(),
      ]);
      if (id !== currentUserRef.current || requestVersion !== refreshAccountVersionRef.current) return;
      if (w.error) throw w.error;
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
      setSyncNotice('Saldo e historial actualizados correctamente.');
      return true;
    } catch (error) {
      if (id === currentUserRef.current && requestVersion === refreshAccountVersionRef.current) {
        setSyncNotice('No se pudo actualizar. Revisa el mensaje de error.');
        message('Sincronización', controller.signal.aborted
          ? 'La consulta tardó demasiado. Vuelve a pulsar Actualizar saldo e historial.'
          : syncErrorMessage(error));
        return false;
      }
    } finally {
      clearTimeout(timeout);
      if (id === currentUserRef.current && requestVersion === refreshAccountVersionRef.current) {
        setSyncing(false);
      }
    }
  }
  async function authenticate(action) {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return message('Correo', 'Introduce un correo válido.');
    if (password.length < 8) return message('Contraseña', 'Debe tener por lo menos 8 caracteres.');
    if (!beginAuthBusy()) return;
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
      endAuthBusy();
    }
  }

  async function requestPasswordReset() {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return message('Correo', 'Introduce un correo válido primero.');
    }
    if (!beginAuthBusy()) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: PASSWORD_RESET_REDIRECT,
      });
      if (error) throw error;
      message('Revisa tu correo',
        'Si existe una cuenta para ese correo, recibirás un enlace para crear una contraseña nueva.');
    } catch (error) {
      message('Recuperar contraseña', error.message || 'No se pudo enviar el enlace.');
    } finally {
      endAuthBusy();
    }
  }

  async function saveNewPassword() {
    if (newPassword.length < 8) return message('Contraseña', 'Usa por lo menos 8 caracteres.');
    if (newPassword !== confirmNewPassword) return message('Contraseña', 'Las contraseñas no coinciden.');
    const actorId = userId;
    if (!isCurrentUser(actorId) || recoveryActorRef.current !== actorId || authEventUserRef.current !== actorId) {
      return message('Sesión', 'El enlace de recuperación no tiene una sesión válida.');
    }
    if (!beginAuthBusy()) return;
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (!isCurrentUser(actorId) || recoveryActorRef.current !== actorId || authEventUserRef.current !== actorId) return;
      if (error) throw error;
      recoveryActorRef.current = null;
      setNewPassword('');
      setConfirmNewPassword('');
      setScreen('Inicio');
      message('Contraseña actualizada', 'La contraseña se actualizó. Tu sesión actual sigue activa.');
    } catch (error) {
      if (isCurrentUser(actorId) && recoveryActorRef.current === actorId && authEventUserRef.current === actorId) {
        message('Contraseña', 'No se pudo actualizar la contraseña. Revisa los requisitos e inténtalo nuevamente.');
      }
    } finally {
      // Liberar el formulario aunque la cuenta haya cambiado mientras esperaba la RPC.
      endAuthBusy();
    }
  }

  async function recoverPendingOperation(id = userId) {
    if (!isCurrentUser(id) || busyRef.current) return;
    const token = {};
    busyRef.current = token;
    const isActive = () => isCurrentUser(id) && busyRef.current === token;
    setBusy(true);
    const storageKey = pendingOperationStorageKey(id);
    let saved = null;
    let pendingValidated = false;
    setPendingOperationRecoveryError('');
    try {
      saved = await AsyncStorage.getItem(storageKey);
      if (!isActive()) return;
      if (!saved) {
        pendingRef.current = null;
        setPendingOperation(null);
        return;
      }
      const pending = parsePendingOperation(saved, id);
      pendingValidated = true;
      // Mostrar y bloquear la referencia local incluso si la consulta de estado pierde conexión.
      pendingRef.current = pending;
      setPendingOperation(pending);
      const statusResponse = await supabase.rpc('mwd_operation_status_demo', {
        p_request_id: pending.id,
      });
      if (statusResponse.error) throw statusResponse.error;
      if (!isActive()) return;
      if (statusResponse.data?.status === 'processed') {
        const result = statusResponse.data;
        if (result.kind !== pending.type || Number(result.amountCents) !== pending.cents ||
            (pending.type === 'transfer' && result.recipientCode !== pending.code)) {
          throw new Error('La referencia local no coincide con la operación confirmada.');
        }
        await AsyncStorage.removeItem(storageKey);
        if (!isActive()) return;
        pendingRef.current = null;
        setPendingOperation(null);
        const refreshed = await refreshAccount(id);
        if (!isActive()) return;
        if (refreshed === true) {
          setSyncNotice('La operación pendiente ya estaba confirmada. Se actualizó tu saldo.');
        } else if (refreshed === false) {
          setSyncNotice('Operación confirmada. Saldo e historial pendientes de actualizar.');
        }
        return;
      }
      if (statusResponse.data?.status !== 'unconfirmed') {
        throw new Error('El estado de la solicitud no se pudo reconocer.');
      }
      pendingRef.current = pending;
      setPendingOperation(pending);
    } catch (error) {
      if (isActive()) {
        if (!pendingValidated) {
          setPendingOperationRecoveryError(
            'No pudimos leer o validar la referencia local. Por seguridad, no iniciaremos otra operación hasta revisarla.'
          );
        }
        setSyncNotice('No se pudo verificar la operación pendiente. Conservamos su referencia para reintentar.');
      }
    } finally {
      if (isActive()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function changeAmount(value) {
    setAmount(value);
  }
  function changeRecipient(value) {
    setRecipientCode(value);
  }

  async function executeOperation(type, cents, code = '') {
    if (busyRef.current) return;
    const actorId = userId;
    if (!isCurrentUser(actorId)) return message('Sesión', 'Inicia sesión para continuar.');
    const token = {};
    busyRef.current = token;
    const isActive = () => isCurrentUser(actorId) && busyRef.current === token;
    setBusy(true);
    let referenceSaved = false;
    try {
      const storageKey = pendingOperationStorageKey(actorId);
      let pending = pendingRef.current;
      if (!pending) {
        const saved = await AsyncStorage.getItem(storageKey);
        if (!isActive()) return;
        if (saved) pending = parsePendingOperation(saved, actorId);
      }
      referenceSaved = !!pending;
      if (pending && (pending.userId !== actorId || pending.type !== type ||
          pending.cents !== cents || pending.code !== code)) {
        pendingRef.current = pending;
        setPendingOperation(pending);
        throw new Error('Hay una operación anterior sin resolver. Reintenta primero con los mismos datos.');
      }
      if (pending) {
        pendingRef.current = pending;
        setPendingOperation(pending);
        const statusResponse = await supabase.rpc('mwd_operation_status_demo', {
          p_request_id: pending.id,
        });
        if (!isActive()) return;
        if (statusResponse.error) throw statusResponse.error;
        if (statusResponse.data?.status === 'processed') {
          const result = statusResponse.data;
          if (result.kind !== pending.type || Number(result.amountCents) !== pending.cents ||
              (pending.type === 'transfer' && result.recipientCode !== pending.code)) {
            throw new Error('La referencia local no coincide con la operación confirmada.');
          }
          await AsyncStorage.removeItem(storageKey);
          if (!isActive()) return;
          pendingRef.current = null;
          setPendingOperation(null);
          setAmount('');
          setRecipientCode('');
          setScreen('Inicio');
          await refreshAccount(actorId);
          if (!isActive()) return;
          message('Operación ya confirmada', 'La solicitud anterior ya quedó registrada. Puedes consultar el estado de la actualización en Inicio.');
          return;
        }
        if (statusResponse.data?.status !== 'unconfirmed') {
          throw new Error('El estado de la solicitud no se pudo reconocer. Conservamos la referencia.');
        }
      } else {
        pending = {
          userId: actorId,
          type,
          cents,
          code,
          id: uniqueRequestId(),
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
        referenceSaved = true;
        if (!isActive()) return;
        pendingRef.current = pending;
        setPendingOperation(pending);
      }
      if (!isActive()) return;
      const requestId = pending.id;
      const response = type === 'transfer'
        ? await supabase.rpc('mwd_transfer_demo', {
          p_recipient_code: code, p_amount_cents: cents, p_request_id: requestId,
        })
        : await supabase.rpc('mwd_contribute_demo', {
          p_amount_cents: cents, p_request_id: requestId,
        });
      if (!isActive()) return;
      if (response.error) {
        if (isDefinitiveRpcRejection(response.error, response.status)) {
          await AsyncStorage.removeItem(storageKey);
          if (!isActive()) return;
          pendingRef.current = null;
          setPendingOperation(null);
          message('Operación rechazada',
            (response.error.message || 'La solicitud fue rechazada.') +
            '\nLa base de datos confirmó que no se registró. Corrige los datos o el saldo e inténtalo de nuevo.');
          return;
        }
        throw response.error;
      }
      if (!['ok', 'already_processed'].includes(response.data?.status) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(response.data.operation_id || '')) {
        throw new Error('La operación no pudo ser confirmada.');
      }
      await AsyncStorage.removeItem(storageKey);
      if (!isActive()) return;
      pendingRef.current = null;
      setPendingOperation(null);
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
      await refreshAccount(actorId);
    } catch (error) {
      if (isActive()) {
        if (!referenceSaved) {
          setPendingOperationRecoveryError('No se pudo verificar o guardar la referencia local. Reintenta la revisión antes de enviar otra operación.');
          message('Referencia no verificada', 'No se envió la operación. No pudimos confirmar el almacenamiento local. Reintenta la revisión.');
          return;
        }
        message('Operación no confirmada',
          (error.message || 'Error desconocido') + '\nLa referencia queda guardada. Reintenta con los mismos datos.');
      }
    } finally {
      if (isActive()) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  function prepareOperation(type) {
    if (pendingOperationRecoveryError) {
      return message('Referencia pendiente', 'Primero revisa la referencia local de la operación anterior.');
    }
    if (busyRef.current) return;
    const cents = amountToCents(amount);
    if (cents === null) {
      return message('Cantidad inválida', 'Introduce un importe positivo, máximo 1,000,000 MWD y dos decimales.');
    }
    if (!wallet) return message('Espera', 'Primero carga tu cuenta.');
    // Tras un error de red el saldo local puede estar desactualizado.
    // Permitir el reintento con la misma clave; el servidor verifica el saldo.
    const code = recipientCode.trim().toUpperCase();
    const existingPending = pendingRef.current || pendingOperation;
    const samePending = existingPending?.type === type &&
      existingPending?.cents === cents &&
      existingPending?.code === (type === 'transfer' ? code : '');
    if (existingPending && !samePending) {
      return message('Operación pendiente', 'Resuelve primero la operación anterior usando los mismos datos.');
    }
    if (cents > wallet.balance_cents && !samePending) {
      return message('Saldo insuficiente', 'No tienes suficientes MWD ficticios.');
    }
    if (type === 'transfer') {
      if (!/^MWD-[A-F0-9]{16}$/.test(code)) {
        return message('Identificador', 'Introduce el código MWD- seguido de 16 caracteres.');
      }
      if (code === wallet.account_code) return message('Destinatario', 'No puedes enviarte MWD a tu propia cuenta.');
    }
    confirmSessionAction(type === 'transfer' ? 'Transferencia de prueba' : 'Aportación de prueba',
      `${formatMWD(cents)} MWD ficticios${type === 'transfer' ? '\nDestino: ' + code : '\nFondo de demostración'}`,
      () => executeOperation(type, cents, type === 'transfer' ? code : ''));
  }

  async function logout() {
    const actorId = userId;
    if (!isCurrentUser(actorId) || !beginAuthBusy()) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // La sesión se actualiza mediante onAuthStateChange, no por una suposición local.
      // No borrar referencias de operaciones pendientes al salir.
      setPassword('');
    } catch (error) {
      if (isCurrentUser(actorId)) {
        message('Salida no confirmada', 'No pudimos confirmar el cierre de sesión. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      endAuthBusy();
    }
  }

  const microDisplay = value => (Number(value || 0) / 1000000).toFixed(6);

  async function loadSwapWallet() {
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    const busyToken = beginSwapBusy();
    if (!busyToken) return;
    const isActive = () => isCurrentUser(actorId) && swapBusyTokenRef.current === busyToken;
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (!isActive()) return;
      if (error) throw error;
      setSwapWallet(data);
    } catch (error) {
      if (isActive()) message('Monedas de prueba', error.message || 'No se pudo cargar la billetera.');
    } finally {
      endSwapBusy(busyToken, actorId);
    }
  }
  async function requestSwapQuote() {
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    const busyToken = beginSwapBusy();
    if (!busyToken) return;
    const isActive = () => isCurrentUser(actorId) && swapBusyTokenRef.current === busyToken;
    swapQuoteRef.current = null;
    setSwapQuote(null);
    try {
      const saved = await AsyncStorage.getItem('mwd:pending-swap:' + actorId);
      if (!isActive()) return;
      if (saved) {
        const pending = JSON.parse(saved);
        if (!pending || pending.userId !== actorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pending.quote?.quoteId || '')) {
          throw new Error('Referencia de conversión pendiente inválida. No se iniciará otra conversión.');
        }
        swapQuoteRef.current = pending.quote;
        setSwapQuote(pending.quote);
        message('Conversión pendiente', 'Confirma nuevamente la misma referencia para recuperar su resultado.');
        return;
      }
      const normalized = swapAmount.trim().replace(',', '.');
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
        return message('Cantidad inválida', 'Usa hasta seis decimales.');
      }
      const [whole, fraction = ''] = normalized.split('.');
      const micro = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
      if (!Number.isSafeInteger(micro) || micro < 1000000 || micro > 10000000000) {
        return message('Cantidad inválida', 'Introduce entre 1 y 10,000 unidades de prueba.');
      }
      const { data, error } = await supabase.rpc('mwd_conversion_quote_demo', {
        p_from_asset: swapFrom, p_amount_micro: micro, p_client_request_id: uniqueRequestId(),
      });
      if (!isActive()) return;
      if (error) throw error;
      swapQuoteRef.current = data;
      setSwapQuote(data);
    } catch (error) {
      if (isActive()) message('Cotización', error.message || 'No se pudo cotizar.');
    } finally {
      endSwapBusy(busyToken, actorId);
    }
  }
  async function confirmSwap(expectedQuoteId) {
    const quote = swapQuoteRef.current;
    if (!quote?.quoteId || quote.quoteId !== expectedQuoteId || swapBusy) {
      return message('Cotización vencida', 'La cotización cambió o ya no está disponible. Solicita una cotización nueva.');
    }
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    const busyToken = beginSwapBusy();
    if (!busyToken) return;
    const isActive = () => isCurrentUser(actorId) && swapBusyTokenRef.current === busyToken;
    try {
      const key = 'mwd:pending-swap:' + actorId;
      const saved = await AsyncStorage.getItem(key);
      if (!isActive()) return;
      if (saved) {
        const pending = JSON.parse(saved);
        if (!pending || pending.userId !== actorId || pending.quote?.quoteId !== quote.quoteId) {
          throw new Error('Existe otra conversión pendiente. Recupera primero su referencia.');
        }
      } else {
        await AsyncStorage.setItem(key, JSON.stringify({userId: actorId, quote}));
      }
      if (!isActive()) return;
      const { data, error, status } = await supabase.rpc('mwd_conversion_confirm_demo', {
        p_quote_id: quote.quoteId,
      });
      if (!isActive()) return;
      if (error) {
        if (isDefinitiveRpcRejection(error, status)) {
          await AsyncStorage.removeItem(key);
          if (!isActive()) return;
          swapQuoteRef.current = null;
          setSwapQuote(null);
          message('Cotización rechazada',
            (error.message || 'La cotización ya no se puede usar.') +
            '\nLa conversión no se registró. Solicita una cotización nueva.');
          return;
        }
        throw error;
      }
      if (!['ok', 'already_processed'].includes(data?.status)) throw new Error('Confirmación no reconocida.');
      await AsyncStorage.removeItem(key);
      if (!isActive()) return;
      swapQuoteRef.current = null;
      setSwapQuote(null);
      setSwapAmount('');
      message('Conversión ficticia', 'Operación registrada correctamente.');
      try {
        const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo');
        if (!isActive()) return;
        if (walletResponse.error) throw walletResponse.error;
        setSwapWallet(walletResponse.data);
      } catch (syncError) {
        if (isActive()) {
          message('Saldo pendiente de actualizar',
            'La conversión se confirmó. Pulsa Consultar saldos para actualizar la pantalla.');
        }
      }
    } catch (error) {
      if (isActive()) {
        message('Conversión no confirmada', (error.message || 'Error desconocido') +
          '\nConsulta los saldos antes de intentar otra conversión.');
      }
    } finally {
      endSwapBusy(busyToken, actorId);
    }
  }
  async function recoverPendingPickup(id = userId) {
    if (!isCurrentUser(id) || pickupBusyRef.current) return;
    const token = {};
    pickupBusyRef.current = token;
    const isActive = () => isCurrentUser(id) && pickupBusyRef.current === token;
    setPickupBusy(true);
    setPickupPendingError('');
    try {
      const saved = await AsyncStorage.getItem(pendingPickupStorageKey(id));
      if (!isActive() || !saved) return;
      const pending = parsePendingPickup(saved, id);
      pickupPendingRef.current = pending;
      setPendingPickup(pending);
      setPickupAmount(formatMWD(pending.cents));
    } catch (error) {
      if (isActive()) {
        setPickupPendingError('Hay una referencia de retiro guardada que no se puede verificar. No crearemos otra orden automáticamente.');
      }
    } finally {
      if (isActive()) {
        pickupBusyRef.current = false;
        setPickupBusy(false);
      }
    }
  }

  async function createDemoPickup() {
    if (pickupBusyRef.current || pickupPendingError) return;
    const cents = amountToCents(pickupAmount);
    if (cents === null || cents < 100 || cents > 100000) {
      return message('Monto inválido', 'Usa entre 1.00 y 1000.00 MWD ficticios.');
    }
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    const token = {};
    pickupBusyRef.current = token;
    const isActive = () => isCurrentUser(actorId) && pickupBusyRef.current === token;
    setPickupBusy(true);
    const storageKey = pendingPickupStorageKey(actorId);
    setPickupResult(null);
    let referenceSaved = false;
    try {
      let pending = pickupPendingRef.current || pendingPickup;
      if (!pending) {
        const saved = await AsyncStorage.getItem(storageKey);
        if (!isActive()) return;
        if (saved) pending = parsePendingPickup(saved, actorId);
      }
      referenceSaved = !!pending;
      if (pending && (pending.userId !== actorId || pending.cents !== cents ||
          pending.destinationCountry !== 'HN')) {
        pickupPendingRef.current = pending;
        setPendingPickup(pending);
        setPickupAmount(formatMWD(pending.cents));
        throw new Error('Hay una orden pendiente. Reintenta primero con el mismo importe.');
      }
      if (!pending) {
        pending = {
          userId: actorId,
          cents,
          destinationCountry: 'HN',
          id: uniqueRequestId(),
          createdAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
        referenceSaved = true;
        if (!isActive()) return;
      }
      pickupPendingRef.current = pending;
      setPendingPickup(pending);
      const { data, error, status } = await supabase.rpc('mwd_pickup_create_demo', {
        p_destination_country: pending.destinationCountry,
        p_amount_cents: pending.cents,
        p_request_id: pending.id,
      });
      if (!isActive()) return;
      if (error) {
        if (isDefinitiveRpcRejection(error, status)) {
          await AsyncStorage.removeItem(storageKey);
          if (!isActive()) return;
          pickupPendingRef.current = null;
          setPendingPickup(null);
          setPickupPendingError('');
          message('Retiro no creado',
            (error.message || 'La solicitud fue rechazada.') +
            '\nLa base de datos confirmó que no se creó una orden. Puedes corregirlo o intentarlo más tarde.');
          return;
        }
        throw error;
      }
      if (!['created', 'already_created'].includes(data?.status) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.orderId || '') ||
          data.realPaymentsEnabled !== false ||
          (data.status === 'created' && (data.isFunded !== false || data.canPayOut !== false ||
            data.amountCents !== pending.cents || data.destinationCountry !== pending.destinationCountry))) {
        throw new Error('Respuesta de retiro no verificable. Conservamos la referencia.');
      }
      await AsyncStorage.removeItem(storageKey);
      if (!isActive()) return;
      pickupPendingRef.current = null;
      setPendingPickup(null);
      setPickupPendingError('');
      setPickupResult(data);
      setPickupAmount('');
      if (data.status === 'already_created' && !data.pickupCode) {
        message('Orden ficticia recuperada',
          'La orden ya existe, pero por seguridad el código de retiro no se vuelve a mostrar. Consulta Mis retiros; no crees otra orden para recuperar el código.');
      }
    } catch (error) {
      if (isActive()) {
        if (!referenceSaved) {
          setPickupPendingError('No se pudo verificar o guardar la referencia local. Reintenta la verificación antes de crear otra orden.');
          message('Referencia de retiro no verificada', 'No se envió la orden. Reintenta la verificación del almacenamiento local.');
          return;
        }
        message('Retiro pendiente de confirmar',
          (error.message || 'No se pudo verificar la orden.') + '\nLa app conservará la misma referencia para reintentar sin duplicar la orden.');
      }
    } finally {
      if (isActive()) {
        pickupBusyRef.current = false;
        setPickupBusy(false);
      }
    }
  }
  async function loadPickupOrders(force = false) {
    const actorId = userId;
    if (!isCurrentUser(actorId) || (pickupOrdersBusyRef.current && force !== true)) return;
    const token = {};
    pickupOrdersBusyRef.current = token;
    const isLatest = () => isCurrentUser(actorId) && pickupOrdersBusyRef.current === token;
    setPickupOrdersBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_my_orders_demo');
      if (!isLatest()) return;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de órdenes no reconocida.');
      setPickupOrders(data);
    } catch (error) {
      if (isLatest()) {
        message('No se pudieron consultar las órdenes', error.message || 'Error desconocido');
      }
    } finally {
      if (isLatest()) {
        pickupOrdersBusyRef.current = false;
        setPickupOrdersBusy(false);
      }
    }
  }
  async function cancelDemoPickup(orderId) {
    const actorId = userId;
    if (!isCurrentUser(actorId) || pickupCancelBusyRef.current) return;
    const token = {};
    pickupCancelBusyRef.current = token;
    const isActive = () => isCurrentUser(actorId) && pickupCancelBusyRef.current === token;
    setPickupCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_cancel_demo', { p_order_id: orderId });
      if (!isActive()) return;
      if (error) throw error;
      if (!['cancelled', 'already_cancelled'].includes(data?.status) || data.orderId !== orderId) throw new Error('Respuesta de cancelación no reconocida.');
      message('Orden ficticia', data.status === 'cancelled' ? 'Orden cancelada correctamente.' : 'La orden ya estaba cancelada.');
      // Invalidar una consulta iniciada antes de confirmar la cancelación.
      await loadPickupOrders(true);
    } catch (error) {
      if (isActive()) message('No se pudo cancelar', error.message || 'Error desconocido');
    } finally {
      if (isActive()) {
        pickupCancelBusyRef.current = false;
        setPickupCancelBusy(false);
      }
    }
  }
  function navigate(to) {
    setScreen(to);
    if (to === 'Convertir') loadSwapWallet();
    if (to === 'MisRetiros') loadPickupOrders();
    // Conservar datos y clave de una operación incierta al cambiar de pantalla.
    // Los campos se limpian tras éxito o al cambiar de cuenta.
    // Se invalida cuando el usuario cambia los datos o al cerrar sesión.
  }

  function resumePendingOperation() {
    const pending = pendingRef.current || pendingOperation;
    if (!pending) return;
    setAmount(formatMWD(pending.cents));
    setRecipientCode(pending.code || '');
    setScreen(pending.type === 'transfer' ? 'Transferir' : 'Aportar');
  }

  function resumePendingPickup() {
    const pending = pickupPendingRef.current || pendingPickup;
    if (!pending) return;
    setPickupAmount(formatMWD(pending.cents));
    setScreen('Retiros');
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView style={styles.scroll} key={scrollKey} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🌐 MONEDA MUNDIAL</Text>
        <Text style={styles.sub}>MWD • Versión 2.0 • Supabase</Text>
        <Text selectable style={styles.buildIdentity}>Compilación: {BUILD_COMMIT}</Text>
        <Text style={styles.warning}>SOLO DEMOSTRACIÓN • SIN DINERO REAL</Text>

        {authLoading || (session && userId !== preparedUserId) ? <ActivityIndicator color="#4a8dff" size="large" /> : !session ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Accede a Moneda Mundial</Text>
            <Text style={styles.muted}>Crea una cuenta de prueba o inicia sesión.</Text>
            <TextInput style={styles.input} placeholder="Correo electrónico" accessibilityLabel="Correo electrónico"
              placeholderTextColor="#9fb1c8" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} editable={!authBusy} />
            <TextInput style={styles.input} placeholder="Contraseña" accessibilityLabel="Contraseña"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={password} onChangeText={setPassword} editable={!authBusy} />
            <Text style={styles.muted}>Mínimo 8 caracteres.</Text>
            <Btn title={authBusy ? 'Espera...' : 'Iniciar sesión'} onPress={() => authenticate('login')} disabled={authBusy} />
            <Btn title="Olvidé mi contraseña" secondary onPress={requestPasswordReset} disabled={authBusy} />
            <Btn title="Crear cuenta de prueba" secondary onPress={() => authenticate('register')} disabled={authBusy} />
            <Text style={styles.muted}>Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.</Text>
          </View>
        ) : (
          <>
            {screen !== 'Inicio' && screen !== 'CambiarContraseña' && <Btn title="← Volver al inicio" secondary onPress={() => navigate('Inicio')} disabled={busy} />}
            {screen === 'CambiarContraseña' && <View style={styles.card}>
              <Text style={styles.heading}>Crear una contraseña nueva</Text>
              <Text style={styles.muted}>Elige una contraseña de al menos 8 caracteres.</Text>
              <TextInput style={styles.input} placeholder="Nueva contraseña"
                placeholderTextColor="#9fb1c8" secureTextEntry autoCapitalize="none"
                autoComplete="new-password" value={newPassword} onChangeText={setNewPassword} editable={!authBusy} />
              <TextInput style={styles.input} placeholder="Confirma la contraseña"
                placeholderTextColor="#9fb1c8" secureTextEntry autoCapitalize="none"
                autoComplete="new-password" value={confirmNewPassword} onChangeText={setConfirmNewPassword} editable={!authBusy} />
              <Btn title={authBusy ? 'Actualizando...' : 'Guardar contraseña'}
                onPress={saveNewPassword} disabled={authBusy} />
              <Btn title="Cancelar recuperación y cerrar sesión" secondary onPress={logout} disabled={authBusy} />
            </View>}
            {screen === 'Inicio' && <>
              <View style={styles.card}>
                <Text style={styles.muted}>TU CUENTA PERSONAL DE PRUEBA</Text>
                <Text style={styles.small}>{session.user.email}</Text>
                <Text style={styles.balance}>{wallet ? formatMWD(wallet.balance_cents) : '...'} MWD</Text>
                <Text style={styles.muted}>Saldo ficticio en Supabase</Text>
                <Text selectable style={styles.code}>{wallet?.account_code || 'Cargando identificador...'}</Text>
              </View>
              {!!pendingOperationRecoveryError && <View style={styles.card}>
                <Text style={styles.heading}>No se pudo revisar la operación anterior</Text>
                <Text style={styles.muted}>{pendingOperationRecoveryError}</Text>
                <Btn title="Reintentar revisión" secondary
                  onPress={() => recoverPendingOperation(userId)} disabled={busy} />
              </View>}
              {!!pendingOperation && <View style={styles.card}>
                <Text style={styles.heading}>Operación pendiente por verificar</Text>
                <Text style={styles.muted}>{pendingOperation.type === 'transfer' ? 'Transferencia' : 'Aportación'} de {formatMWD(pendingOperation.cents)} MWD. La app conservará la misma referencia al reintentar.</Text>
                <Btn title="Revisar / reintentar operación" onPress={resumePendingOperation} disabled={busy} />
              </View>}
              {!!pendingPickup && <View style={styles.card}>
                <Text style={styles.heading}>Retiro pendiente por verificar</Text>
                <Text style={styles.muted}>{formatMWD(pendingPickup.cents)} MWD ficticios a Honduras. Al reintentar se usará la misma referencia para no crear otra orden.</Text>
                <Btn title="Revisar / reintentar retiro" onPress={resumePendingPickup} disabled={pickupBusy} />
              </View>}
              {!!pickupPendingError && <View style={styles.card}>
                <Text style={styles.heading}>No se pudo verificar el retiro</Text>
                <Text style={styles.muted}>{pickupPendingError}</Text>
                <Btn title="Reintentar verificación" secondary
                  onPress={() => recoverPendingPickup(userId)} disabled={pickupBusy} />
              </View>}
              <Btn title="Transferir MWD entre usuarios" onPress={() => navigate('Transferir')} disabled={!wallet || !!pendingOperation || !!pendingOperationRecoveryError} />
              <Btn title="Registrar aportación ficticia" onPress={() => navigate('Aportar')} disabled={!wallet || !!pendingOperation || !!pendingOperationRecoveryError} />
              <Btn title="Mis movimientos" secondary onPress={() => navigate('Historial')} />
              <Btn title="Cotizar remesa internacional (DEMO)" secondary onPress={() => navigate("CotizarRemesa")} />
              <Btn title="Remesas y retiros ficticios" secondary onPress={() => navigate("Retiros")} />
              <Btn title="Mis retiros ficticios" secondary onPress={() => navigate("MisRetiros")} />
              <Btn title="Coin / Digital (simulador)" secondary onPress={() => navigate('Convertir')} />
              <Btn title="Mi cuenta / recibir" secondary onPress={() => navigate('Cuenta')} />
              <Btn title={syncing ? "Actualizando..." : "Actualizar saldo e historial"} secondary onPress={() => refreshAccount()} disabled={syncing} />
              {!!syncNotice && <Text style={styles.muted}>{syncNotice}</Text>}
              <Btn title="Administración" secondary onPress={() => navigate('Admin')} />
              <Btn title={authBusy ? 'Espera...' : 'Cerrar sesión'} secondary onPress={logout} disabled={authBusy} />
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
                  <Text style={styles.small}>Estado: {pickupStatusLabel(order.status)}</Text>
                  <Text style={styles.muted}>Creada: {new Date(order.createdAt).toLocaleString()}</Text>
                  <Text style={styles.muted}>Vence: {new Date(order.expiresAt).toLocaleString()}</Text>
                  <Text selectable style={styles.muted}>Referencia: {order.orderId}</Text>
                  {order.status === 'pending' && <Btn title={pickupCancelBusy ? 'Procesando...' : 'Cancelar esta orden'}
                    secondary disabled={pickupCancelBusy || pickupOrdersBusy}
                    onPress={() => confirmSessionAction('Cancelar orden ficticia',
                      'Esta acción cancelará la orden seleccionada. No afecta dinero real.',
                      () => cancelDemoPickup(order.orderId))} />}
                </View>
              ))}
            </View>}

            {screen === 'CotizarRemesa' && <RemittanceQuoteScreen key={userId} supabase={supabase}
              isActive={() => isCurrentUser(userId) && authEventUserRef.current === userId} />}
            
            {screen === 'Retiros' && <View style={styles.card}>
              <Text style={styles.heading}>Retiro ficticio a Honduras</Text>
              <Text style={styles.warning}>Solo simulación. No se entrega dinero real.</Text>
              <Text style={styles.muted}>Monto de prueba: 1.00 a 1000.00 MWD</Text>
              <TextInput style={styles.input} placeholder="Ejemplo: 10.00"
                placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                value={pickupAmount} onChangeText={setPickupAmount} editable={!pickupBusy && !pendingPickup && !pickupPendingError} />
              <Text style={styles.muted}>Máximo 5 órdenes nuevas por hora por cuenta. Vigencia: 24 horas.</Text>
              <Btn title={pickupBusy ? 'Verificando...' : pendingPickup ? 'Reintentar orden pendiente' : 'Crear orden ficticia'}
                onPress={createDemoPickup} disabled={pickupBusy || !!pickupPendingError} />
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
                  swapQuoteRef.current = null;
                  setSwapQuote(null);
                }} />
              <TextInput style={styles.input} placeholder="Cantidad (mínimo 1)"
                keyboardType="decimal-pad" placeholderTextColor="#9fb1c8"
                value={swapAmount} onChangeText={value => {
                  setSwapAmount(value);
                  swapQuoteRef.current = null;
                  setSwapQuote(null);
                }} />
              <Btn title={swapBusy ? 'Procesando...' : 'Solicitar cotización ficticia'}
                disabled={swapBusy || !swapWallet} onPress={requestSwapQuote} />
              {swapQuote && <View>
                <Text style={styles.muted}>Recibirías: {microDisplay(swapQuote.amountOutMicro)} {swapQuote.toAsset === 'STABLE' ? 'DIGITAL' : 'COIN'}</Text>
                <Text style={styles.muted}>Comisión: {microDisplay(swapQuote.feeOutMicro)} {swapQuote.toAsset === 'STABLE' ? 'DIGITAL' : 'COIN'}</Text>
                <Text style={styles.muted}>Cotización válida hasta: {new Date(swapQuote.expiresAt).toLocaleTimeString()}</Text>
                <Btn title="Confirmar conversión ficticia" disabled={swapBusy}
                  onPress={() => confirmSessionAction('Confirmar conversión ficticia',
                    'Esta operación modificará únicamente los saldos de prueba.',
                    () => confirmSwap(swapQuote.quoteId))} />
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111f' },
  scroll: { flex: 1 },
  body: { padding: 22, paddingTop: 16, paddingBottom: 24 },
  logo: { color: '#ffffff', fontSize: 25, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#9ab0cf', textAlign: 'center', marginTop: 6 },
  buildIdentity: { color: '#9ab0cf', textAlign: 'center', marginTop: 4, fontSize: 10 },
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
