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

function pendingOperationStorageKey(userId) {
  return 'mwd_pending_operation:' + userId;
}

function pendingPickupStorageKey(userId) {
  return 'mwd_pending_pickup:' + userId;
}

function parsePendingPickup(saved, userId) {
  const pending = JSON.parse(saved);
  if (pending.userId !== userId || !/^[0-9a-f-]{36}$/i.test(pending.id || '') ||
      pending.destinationCountry !== 'HN' || !Number.isSafeInteger(pending.cents) ||
      pending.cents < 100 || pending.cents > 100000) {
    throw new Error('La solicitud de retiro guardada no tiene un formato válido.');
  }
  return pending;
}

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
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const pickupPendingRef = useRef(null);
  const pickupBusyRef = useRef(false);
  const currentUserRef = useRef(null);
  const userId = session?.user?.id;
  // Actualizar durante render para invalidar respuestas de red de cuentas anteriores.
  currentUserRef.current = userId;
  const isCurrentUser = id => !!id && id === currentUserRef.current;

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        // Una respuesta inicial tardía no debe sobrescribir una sesión más reciente.
        if (active && !authEventReceived) setSession(data.session);
      })
      .catch(error => message('Sesión', error.message))
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authEventReceived = true;
      setSession(nextSession);
      setAuthLoading(false);
      // TOKEN_REFRESHED no debe expulsar al usuario de una pantalla activa.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setScreen('Inicio');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    // No reutilizar identificadores de operaciones entre cuentas diferentes.
    pendingRef.current = null;
    pickupPendingRef.current = null;
    pickupBusyRef.current = false;
    busyRef.current = false;
    setBusy(false);
    setSwapBusy(false);
    setPickupBusy(false);
    setPickupOrdersBusy(false);
    setPickupCancelBusy(false);
    // Ocultar inmediatamente información de la cuenta anterior durante un cambio de usuario.
    setWallet(null);
    setOperations([]);
    setAdminRole(null);
    setSwapWallet(null);
    setSwapQuote(null);
    setPickupOrders([]);
    setPickupResult(null);
    setAmount('');
    setRecipientCode('');
    setPickupAmount('');
    setPendingOperation(null);
    setPendingPickup(null);
    setPickupPendingError('');
    if (!userId) {
      return;
    }
    refreshAccount(userId);
    recoverPendingOperation(userId);
    recoverPendingPickup(userId);
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!isCurrentUser(id)) return;
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
      if (id !== currentUserRef.current) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
      setSyncNotice('Saldo e historial actualizados correctamente.');
    } catch (error) {
      if (id === currentUserRef.current) {
        setSyncNotice('No se pudo actualizar. Revisa el mensaje de error.');
        message('Sincronización', error.message || 'No se pudo consultar Supabase.');
      }
    } finally {
      if (id === currentUserRef.current) setSyncing(false);
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

  async function recoverPendingOperation(id = userId) {
    if (!id) return;
    const storageKey = pendingOperationStorageKey(id);
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      if (id !== currentUserRef.current) return;
      if (!saved) return;
      const pending = JSON.parse(saved);
      if (pending.userId !== id || !/^[0-9a-f-]{36}$/i.test(pending.id || '') ||
          !['transfer', 'contribution'].includes(pending.type) ||
          !Number.isSafeInteger(pending.cents) || pending.cents < 1 ||
          (pending.type === 'transfer' && !/^MWD-[A-F0-9]{16}$/.test(pending.code || ''))) {
        throw new Error('La solicitud guardada no tiene un formato válido.');
      }
      const statusResponse = await supabase.rpc('mwd_operation_status_demo', {
        p_request_id: pending.id,
      });
      if (statusResponse.error) throw statusResponse.error;
      if (id !== currentUserRef.current) return;
      if (statusResponse.data?.status === 'processed') {
        const result = statusResponse.data;
        if (result.kind !== pending.type || Number(result.amountCents) !== pending.cents ||
            (pending.type === 'transfer' && result.recipientCode !== pending.code)) {
          throw new Error('La referencia local no coincide con la operación confirmada.');
        }
        await AsyncStorage.removeItem(storageKey);
        if (id !== currentUserRef.current) return;
        pendingRef.current = null;
        setPendingOperation(null);
        await refreshAccount(id);
        if (id !== currentUserRef.current) return;
        setSyncNotice('La operación pendiente ya estaba confirmada. Se actualizó tu saldo.');
        return;
      }
      if (statusResponse.data?.status !== 'unconfirmed') {
        throw new Error('El estado de la solicitud no se pudo reconocer.');
      }
      pendingRef.current = pending;
      setPendingOperation(pending);
    } catch (error) {
      if (id === currentUserRef.current) {
        setSyncNotice('No se pudo verificar la operación pendiente. Conservamos su referencia para reintentar.');
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
    busyRef.current = true;
    setBusy(true);
    try {
      const storageKey = pendingOperationStorageKey(actorId);
      let pending = pendingRef.current;
      if (!pending) {
        const saved = await AsyncStorage.getItem(storageKey);
        if (!isCurrentUser(actorId)) return;
        if (saved) pending = JSON.parse(saved);
      }
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
        if (!isCurrentUser(actorId)) return;
        if (statusResponse.error) throw statusResponse.error;
        if (statusResponse.data?.status === 'processed') {
          const result = statusResponse.data;
          if (result.kind !== pending.type || Number(result.amountCents) !== pending.cents ||
              (pending.type === 'transfer' && result.recipientCode !== pending.code)) {
            throw new Error('La referencia local no coincide con la operación confirmada.');
          }
          await AsyncStorage.removeItem(storageKey);
          if (!isCurrentUser(actorId)) return;
          pendingRef.current = null;
          setPendingOperation(null);
          setAmount('');
          setRecipientCode('');
          setScreen('Inicio');
          await refreshAccount(actorId);
          if (!isCurrentUser(actorId)) return;
          message('Operación ya confirmada', 'Supabase confirmó la solicitud anterior. El saldo e historial se actualizaron sin enviar otra operación.');
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
        if (!isCurrentUser(actorId)) return;
        pendingRef.current = pending;
        setPendingOperation(pending);
      }
      if (!isCurrentUser(actorId)) return;
      const requestId = pending.id;
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
      await AsyncStorage.removeItem(storageKey);
      if (!isCurrentUser(actorId)) return;
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
      if (isCurrentUser(actorId)) {
        message('Operación no confirmada',
          (error.message || 'Error desconocido') + '\nLa referencia queda guardada. Reintenta con los mismos datos.');
      }
    } finally {
      if (isCurrentUser(actorId)) {
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
    confirmAction(type === 'transfer' ? 'Transferencia de prueba' : 'Aportación de prueba',
      `${formatMWD(cents)} MWD ficticios${type === 'transfer' ? '\nDestino: ' + code : '\nFondo de demostración'}`,
      () => executeOperation(type, cents, type === 'transfer' ? code : ''));
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) message('Salida', error.message);
  }

  const microDisplay = value => (Number(value || 0) / 1000000).toFixed(6);

  async function loadSwapWallet() {
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      setSwapWallet(data);
    } catch (error) {
      if (isCurrentUser(actorId)) message('Monedas de prueba', error.message || 'No se pudo cargar la billetera.');
    } finally {
      if (isCurrentUser(actorId)) setSwapBusy(false);
    }
  }
  async function requestSwapQuote() {
    const normalized = swapAmount.trim().replace(',', '.');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
      return message('Cantidad inválida', 'Usa hasta seis decimales.');
    }
    const [whole, fraction = ''] = normalized.split('.');
    const micro = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
    if (!Number.isSafeInteger(micro) || micro < 1000000 || micro > 10000000000) {
      return message('Cantidad inválida', 'Introduce entre 1 y 10,000 unidades de prueba.');
    }
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    setSwapBusy(true);
    setSwapQuote(null);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_quote_demo', {
        p_from_asset: swapFrom, p_amount_micro: micro, p_client_request_id: uniqueRequestId(),
      });
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      setSwapQuote(data);
    } catch (error) {
      if (isCurrentUser(actorId)) message('Cotización', error.message || 'No se pudo cotizar.');
    } finally {
      if (isCurrentUser(actorId)) setSwapBusy(false);
    }
  }
  async function confirmSwap() {
    if (!swapQuote?.quoteId || swapBusy) return;
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    const quote = swapQuote;
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_confirm_demo', {
        p_quote_id: quote.quoteId,
      });
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      if (!['ok', 'already_processed'].includes(data?.status)) throw new Error('Confirmación no reconocida.');
      setSwapQuote(null);
      setSwapAmount('');
      message('Conversión ficticia', 'Operación registrada correctamente.');
      try {
        const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo');
        if (!isCurrentUser(actorId)) return;
        if (walletResponse.error) throw walletResponse.error;
        setSwapWallet(walletResponse.data);
      } catch (syncError) {
        if (isCurrentUser(actorId)) {
          message('Saldo pendiente de actualizar',
            'La conversión se confirmó. Pulsa Consultar saldos para actualizar la pantalla.');
        }
      }
    } catch (error) {
      if (isCurrentUser(actorId)) {
        message('Conversión no confirmada', (error.message || 'Error desconocido') +
          '\nConsulta los saldos antes de intentar otra conversión.');
      }
    } finally {
      if (isCurrentUser(actorId)) setSwapBusy(false);
    }
  }
  async function recoverPendingPickup(id = userId) {
    if (!isCurrentUser(id)) return;
    setPickupPendingError('');
    try {
      const saved = await AsyncStorage.getItem(pendingPickupStorageKey(id));
      if (!isCurrentUser(id) || !saved) return;
      const pending = parsePendingPickup(saved, id);
      pickupPendingRef.current = pending;
      setPendingPickup(pending);
      setPickupAmount(formatMWD(pending.cents));
    } catch (error) {
      if (isCurrentUser(id)) {
        setPickupPendingError('Hay una referencia de retiro guardada que no se puede verificar. No crearemos otra orden automáticamente.');
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
    pickupBusyRef.current = true;
    setPickupBusy(true);
    const storageKey = pendingPickupStorageKey(actorId);
    setPickupResult(null);
    try {
      let pending = pickupPendingRef.current || pendingPickup;
      if (!pending) {
        const saved = await AsyncStorage.getItem(storageKey);
        if (!isCurrentUser(actorId)) return;
        if (saved) pending = parsePendingPickup(saved, actorId);
      }
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
        if (!isCurrentUser(actorId)) return;
      }
      pickupPendingRef.current = pending;
      setPendingPickup(pending);
      const { data, error } = await supabase.rpc('mwd_pickup_create_demo', {
        p_destination_country: pending.destinationCountry,
        p_amount_cents: pending.cents,
        p_request_id: pending.id,
      });
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      if (!['created', 'already_created'].includes(data?.status)) throw new Error('Respuesta inesperada.');
      await AsyncStorage.removeItem(storageKey);
      if (!isCurrentUser(actorId)) return;
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
      if (isCurrentUser(actorId)) {
        message('Retiro pendiente de confirmar',
          (error.message || 'No se pudo verificar la orden.') + '\nLa app conservará la misma referencia para reintentar sin duplicar la orden.');
      }
    } finally {
      if (isCurrentUser(actorId)) {
        pickupBusyRef.current = false;
        setPickupBusy(false);
      }
    }
  }
  async function loadPickupOrders() {
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    setPickupOrdersBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_my_orders_demo');
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de órdenes no reconocida.');
      setPickupOrders(data);
    } catch (error) {
      if (isCurrentUser(actorId)) {
        message('No se pudieron consultar las órdenes', error.message || 'Error desconocido');
      }
    } finally {
      if (isCurrentUser(actorId)) setPickupOrdersBusy(false);
    }
  }
  async function cancelDemoPickup(orderId) {
    if (pickupCancelBusy) return;
    const actorId = userId;
    if (!isCurrentUser(actorId)) return;
    setPickupCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_cancel_demo', { p_order_id: orderId });
      if (!isCurrentUser(actorId)) return;
      if (error) throw error;
      if (!['cancelled', 'already_cancelled'].includes(data?.status)) throw new Error('Respuesta de cancelación no reconocida.');
      message('Orden ficticia', data.status === 'cancelled' ? 'Orden cancelada correctamente.' : 'La orden ya estaba cancelada.');
      await loadPickupOrders();
    } catch (error) {
      if (isCurrentUser(actorId)) message('No se pudo cancelar', error.message || 'Error desconocido');
    } finally {
      if (isCurrentUser(actorId)) setPickupCancelBusy(false);
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
              <Btn title="Transferir MWD entre usuarios" onPress={() => navigate('Transferir')} disabled={!wallet || !!pendingOperation} />
              <Btn title="Registrar aportación ficticia" onPress={() => navigate('Aportar')} disabled={!wallet || !!pendingOperation} />
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
