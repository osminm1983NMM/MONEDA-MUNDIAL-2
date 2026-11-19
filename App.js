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
  const swapQuoteRevisionRef = useRef(0);
  const swapConfirmRevisionRef = useRef(0);
  const [pickupAmount, setPickupAmount] = useState('');
  const pickupPendingRef = useRef(null);
  const [pickupBusy, setPickupBusy] = useState(false);
  const pickupCreateRevisionRef = useRef(0);
  const [pickupResult, setPickupResult] = useState(null);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [pickupOrdersBusy, setPickupOrdersBusy] = useState(false);
  const [pickupCancelBusy, setPickupCancelBusy] = useState(false);
  const pickupCancelRevisionRef = useRef(0);
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const operationRevisionRef = useRef(0);
  const pendingRef = useRef(null);
  const accountRefreshRevisionRef = useRef(0);
  const authIdentityRef = useRef(undefined);
  const authEventSeenRef = useRef(false);
  const swapWalletRevisionRef = useRef(0);
  const pickupOrdersRevisionRef = useRef(0);
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active && !authEventSeenRef.current) {
          const nextId = data.session?.user?.id || null;
          if (authIdentityRef.current === undefined) authIdentityRef.current = nextId;
          setSession(data.session);
        }
      })
      .catch(error => {
        if (active && !authEventSeenRef.current) {
          message('Sesión', error.message || 'No se pudo comprobar la sesión inicial.');
        }
      })
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEventSeenRef.current = true;
      const nextId = nextSession?.user?.id || null;
      if (authIdentityRef.current !== undefined && authIdentityRef.current !== nextId) {
        setScreen('Inicio');
      }
      authIdentityRef.current = nextId;
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    accountRefreshRevisionRef.current += 1;
    swapWalletRevisionRef.current += 1;
    pickupOrdersRevisionRef.current += 1;
    pendingRef.current = null;
    // Invalidar operaciones antiguas sin permitir que su finally libere un bloqueo nuevo.
    operationRevisionRef.current += 1;
    swapConfirmRevisionRef.current += 1;
    pickupCreateRevisionRef.current += 1;
    pickupCancelRevisionRef.current += 1;
    setSwapBusy(false);
    setPickupBusy(false);
    setPickupCancelBusy(false);
    busyRef.current = false;
    setBusy(false);
    setAmount('');
    setRecipientCode('');
    if (!userId) {
      setWallet(null);
      setOperations([]);
      setAdminRole(null);
      setSwapWallet(null);
      swapQuoteRevisionRef.current += 1;
      setSwapQuote(null);
      pickupPendingRef.current = null;
      setPickupResult(null);
      setPickupOrders([]);
      setSyncNotice('');
      return;
    }
    pickupPendingRef.current = null;
    setPickupResult(null);
    setPickupOrders([]);
    setWallet(null);
    setOperations([]);
    setAdminRole(null);
    setSwapWallet(null);
    swapQuoteRevisionRef.current += 1;
    setSwapQuote(null);
    setSyncNotice('');
    refreshAccount(userId);
  }, [userId]);

  async function refreshAccount(id = userId) {
    if (!id) return;
    const revision = ++accountRefreshRevisionRef.current;
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
      const authResult = await supabase.auth.getSession();
      if (authResult.error) throw authResult.error;
      if (revision !== accountRefreshRevisionRef.current || authResult.data.session?.user?.id !== id) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
      setSyncNotice('Saldo e historial actualizados correctamente.');
    } catch (error) {
      if (revision !== accountRefreshRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== id) return;
      } catch (authError) {
        if (revision !== accountRefreshRevisionRef.current) return;
        setSyncNotice('No se pudo verificar la sesión. Vuelve a consultar.');
        message('Sesión no verificada', 'No se pudo comprobar la cuenta actual. Verifica tu sesión antes de operar.');
        return;
      }
      if (revision !== accountRefreshRevisionRef.current) return;
      setSyncNotice('No se pudo actualizar. Revisa el mensaje de error.');
      message('Sincronización', error.message || 'No se pudo consultar Supabase.');
    } finally {
      if (revision === accountRefreshRevisionRef.current) setSyncing(false);
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
    if (busyRef.current || !userId) return;
    const operationUserId = userId;
    const operationRevision = ++operationRevisionRef.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const pending = pendingRef.current;
      if (!pending || pending.userId !== operationUserId || pending.type !== type || pending.cents !== cents || pending.code !== code) {
        pendingRef.current = { userId: operationUserId, type, cents, code, id: uniqueRequestId() };
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
      // La RPC ya confirmó el movimiento; un fallo posterior de sesión o lectura
      // no debe presentarlo como una transferencia/aportación fallida.
      let currentAuth;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        currentAuth = authResult.data;
      } catch (authError) {
        message('Movimiento registrado; sesión pendiente',
          'Supabase confirmó el movimiento ficticio. Verifica tu sesión y consulta el historial antes de intentar otro envío.');
        return;
      }
      if (currentAuth.session?.user?.id !== operationUserId) return;
      pendingRef.current = null;
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      message('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
      try {
        await refreshAccount();
      } catch (refreshError) {
        message('Actualización pendiente',
          'El movimiento fue confirmado, pero el saldo o historial requiere actualización.');
      }
    } catch (error) {
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== operationUserId) return;
      } catch (authError) {
        message('Resultado pendiente de verificación',
          'No fue posible consultar la sesión. Comprueba tu cuenta e historial antes de reintentar.');
        return;
      }
      message('Operación no confirmada',
        (error.message || 'Error desconocido') + '\nPuedes reintentar sin cambiar los datos.');
    } finally {
      if (operationRevision === operationRevisionRef.current) {
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
    const code = recipientCode.trim().toUpperCase();
    const pending = pendingRef.current;
    const retrySameRequest = pending?.userId === userId && pending.type === type &&
      pending.cents === cents && pending.code === code;
    // Un reintento incierto conserva su clave aunque el primer intento haya debitado el saldo.
    // El servidor debe aplicar idempotencia y validar los fondos en solicitudes nuevas.
    if (!retrySameRequest && cents > wallet.balance_cents) {
      return message('Saldo insuficiente', 'No tienes suficientes MWD ficticios.');
    }
    if (type === 'transfer') {
      if (!/^MWD-[A-F0-9]{16}$/.test(code)) {
        return message('Identificador', 'Introduce el código MWD- seguido de 16 caracteres.');
      }
      if (code === wallet.account_code) return message('Destinatario', 'No puedes enviarte MWD a tu propia cuenta.');
    }
    confirmAction(type === 'transfer' ? 'Transferencia de prueba' : 'Aportación de prueba',
      `${formatMWD(cents)} MWD ficticios${type === 'transfer' ? '\nDestino: ' + code : '\nFondo de demostración'}${retrySameRequest ? '\nReintento de la misma solicitud: no se debe generar un segundo movimiento.' : ''}`,
      () => executeOperation(type, cents, code));
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) message('Salida', error.message);
  }

  const microDisplay = value => (Number(value || 0) / 1000000).toFixed(6);

  async function loadSwapWallet() {
    const requestedBy = userId;
    if (!requestedBy) return;
    const revision = ++swapWalletRevisionRef.current;
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (error) throw error;
      const { data: currentAuth } = await supabase.auth.getSession();
      if (currentAuth.session?.user?.id !== requestedBy || revision !== swapWalletRevisionRef.current) return;
      setSwapWallet(data);
    } catch (error) {
      if (revision !== swapWalletRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        if (revision !== swapWalletRevisionRef.current) return;
        message('Sesión no verificada', 'Comprueba tu sesión antes de consultar las monedas de prueba.');
        return;
      }
      if (revision !== swapWalletRevisionRef.current) return;
      message('Monedas de prueba', error.message || 'No se pudo cargar la billetera.');
    } finally {
      if (revision === swapWalletRevisionRef.current) setSwapBusy(false);
    }
  }

  async function requestSwapQuote() {
    if (swapBusy || !userId) return;
    const normalized = swapAmount.trim().replace(',', '.');
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
      return message('Cantidad inválida', 'Usa hasta seis decimales.');
    }
    const [whole, fraction = ''] = normalized.split('.');
    const micro = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
    if (!Number.isSafeInteger(micro) || micro < 1000000 || micro > 10000000000) {
      return message('Cantidad inválida', 'Introduce entre 1 y 10,000 unidades de prueba.');
    }
    const revision = ++swapQuoteRevisionRef.current;
    const requestedBy = userId;
    setSwapBusy(true);
    setSwapQuote(null);
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_quote_demo', {
        p_from_asset: swapFrom, p_amount_micro: micro, p_client_request_id: uniqueRequestId(),
      });
      if (error) throw error;
      const { data: currentAuth } = await supabase.auth.getSession();
      if (currentAuth.session?.user?.id !== requestedBy || revision !== swapQuoteRevisionRef.current) return;
      setSwapQuote(data);
    } catch (error) {
      if (revision !== swapQuoteRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        if (revision !== swapQuoteRevisionRef.current) return;
        message('Sesión no verificada', 'Comprueba tu sesión antes de solicitar otra cotización.');
        return;
      }
      if (revision !== swapQuoteRevisionRef.current) return;
      message('Cotización', error.message || 'No se pudo cotizar.');
    } finally {
      if (revision === swapQuoteRevisionRef.current) setSwapBusy(false);
    }
  }

  async function confirmSwap() {
    if (!swapQuote?.quoteId || swapBusy || !userId) return;
    const requestedBy = userId;
    const confirmRevision = ++swapConfirmRevisionRef.current;
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
      // Una confirmación recibida del servidor no debe convertirse en error
      // por un fallo posterior al consultar la sesión.
      let currentAuth;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        currentAuth = authResult.data;
      } catch (authError) {
        message('Conversión registrada; sesión pendiente',
          'Supabase confirmó la conversión ficticia. Verifica tu sesión y consulta los saldos antes de repetirla.');
        return;
      }
      if (currentAuth.session?.user?.id !== requestedBy) return;
      setSwapQuote(null);
      setSwapAmount('');
      message('Conversión ficticia', 'Operación registrada correctamente. Actualizando saldos de prueba.');
      // No permitir que una consulta posterior sobrescriba otra más reciente.
      const walletRevision = ++swapWalletRevisionRef.current;
      try {
        const walletResponse = await supabase.rpc('mwd_conversion_wallet_demo');
        if (walletResponse.error) throw walletResponse.error;
        const { data: latestAuth } = await supabase.auth.getSession();
        if (latestAuth.session?.user?.id !== requestedBy || walletRevision !== swapWalletRevisionRef.current) return;
        setSwapWallet(walletResponse.data);
      } catch (refreshError) {
        let latestAuth;
        try {
          const authResult = await supabase.auth.getSession();
          if (authResult.error) throw authResult.error;
          latestAuth = authResult.data;
        } catch (authError) {
          message('Actualización pendiente',
            'La conversión ficticia fue confirmada. Verifica tu sesión y consulta los saldos antes de otra operación.');
          return;
        }
        if (latestAuth.session?.user?.id !== requestedBy || walletRevision !== swapWalletRevisionRef.current) return;
        setSwapWallet(null);
        message('Actualización pendiente',
          'La conversión ficticia fue confirmada, pero no se pudieron consultar los saldos. Usa Consultar saldos antes de otra operación.');
      }
    } catch (error) {
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        message('Resultado de conversión pendiente',
          'No fue posible verificar la sesión. Consulta tu cuenta y los saldos antes de intentar otra conversión.');
        return;
      }
      message('Conversión no confirmada', (error.message || 'Error desconocido') +
        '\nConsulta los saldos antes de intentar otra conversión.');
    } finally {
      if (confirmRevision === swapConfirmRevisionRef.current) setSwapBusy(false);
    }
  }

  async function createDemoPickup() {
    if (pickupBusy || !userId) return;
    const requestedBy = userId;
    const createRevision = ++pickupCreateRevisionRef.current;
    const cents = amountToCents(pickupAmount);
    if (cents === null || cents < 100 || cents > 100000) {
      return message('Monto inválido', 'Usa entre 1.00 y 1000.00 MWD ficticios.');
    }
    if (!pickupPendingRef.current || pickupPendingRef.current.cents !== cents || pickupPendingRef.current.userId !== userId) {
      pickupPendingRef.current = { cents, userId, id: uniqueRequestId() };
    }
    const requestId = pickupPendingRef.current.id;
    setPickupBusy(true);
    setPickupResult(null);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_create_demo', {
        p_destination_country: 'HN', p_amount_cents: cents, p_request_id: requestId,
      });
      if (error) throw error;
      if (!['created', 'already_created'].includes(data?.status)) throw new Error('Respuesta inesperada.');
      // El servidor ya confirmó la creación: un fallo de sesión posterior
      // no debe presentarse como una orden fallida ni generar un reintento ciego.
      let currentAuth;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        currentAuth = authResult.data;
      } catch (authError) {
        if (createRevision !== pickupCreateRevisionRef.current) return;
        message('Orden registrada; sesión pendiente',
          'Supabase confirmó la orden ficticia. Verifica tu sesión y consulta Mis retiros antes de intentar otra orden.');
        return;
      }
      if (createRevision !== pickupCreateRevisionRef.current || currentAuth.session?.user?.id !== requestedBy) return;
      setPickupResult(data);
      pickupPendingRef.current = null;
      setPickupAmount('');
      // La actualización secundaria no debe cambiar el resultado confirmado de la creación.
      loadPickupOrders().catch(() => {
        if (createRevision !== pickupCreateRevisionRef.current) return;
        message('Actualización pendiente', 'Orden ficticia creada; consulta Mis retiros para actualizar la lista.');
      });
    } catch (error) {
      if (createRevision !== pickupCreateRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (createRevision !== pickupCreateRevisionRef.current || authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        if (createRevision !== pickupCreateRevisionRef.current) return;
        message('Resultado de orden pendiente',
          'No fue posible verificar la sesión. Consulta tu cuenta y Mis retiros antes de intentar otra orden.');
        return;
      }
      if (createRevision !== pickupCreateRevisionRef.current) return;
      message('Resultado de orden no confirmado',
        (error.message || 'Error de conexión') +
        '\nLa orden pudo haberse creado. Consulta Mis retiros y, si reintentas con el mismo monto, se conservará el identificador de solicitud.');
    } finally {
      if (createRevision === pickupCreateRevisionRef.current) setPickupBusy(false);
    }
  }

  async function loadPickupOrders() {
    const requestedBy = userId;
    if (!requestedBy) return;
    const revision = ++pickupOrdersRevisionRef.current;
    setPickupOrdersBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_my_orders_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de órdenes no reconocida.');
      const { data: currentAuth } = await supabase.auth.getSession();
      if (currentAuth.session?.user?.id !== requestedBy || revision !== pickupOrdersRevisionRef.current) return;
      setPickupOrders(data);
    } catch (error) {
      if (revision !== pickupOrdersRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        if (revision !== pickupOrdersRevisionRef.current) return;
        message('Sesión no verificada', 'No se pudo verificar la cuenta al consultar Mis retiros.');
        return;
      }
      if (revision !== pickupOrdersRevisionRef.current) return;
      message('No se pudieron consultar las órdenes', error.message || 'Error desconocido');
    } finally {
      if (revision === pickupOrdersRevisionRef.current) setPickupOrdersBusy(false);
    }
  }

  async function cancelDemoPickup(orderId) {
    if (pickupCancelBusy || !userId) return;
    const requestedBy = userId;
    const cancelRevision = ++pickupCancelRevisionRef.current;
    setPickupCancelBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pickup_cancel_demo', { p_order_id: orderId });
      if (error) throw error;
      if (!['cancelled', 'already_cancelled'].includes(data?.status)) throw new Error('Respuesta de cancelación no reconocida.');
      // Una cancelación confirmada no debe pasar a "no confirmada" por un error de sesión posterior.
      let currentAuth;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        currentAuth = authResult.data;
      } catch (authError) {
        if (cancelRevision !== pickupCancelRevisionRef.current) return;
        message('Cancelación registrada; sesión pendiente',
          'Supabase confirmó la cancelación ficticia. Verifica tu sesión y consulta Mis retiros antes de repetirla.');
        return;
      }
      if (cancelRevision !== pickupCancelRevisionRef.current || currentAuth.session?.user?.id !== requestedBy) return;
      message('Orden ficticia', data.status === 'cancelled' ? 'Orden cancelada correctamente.' : 'La orden ya estaba cancelada.');
      // La consulta posterior no debe convertir una cancelación confirmada en un fallo.
      loadPickupOrders().catch(() => {
        if (cancelRevision !== pickupCancelRevisionRef.current) return;
        message('Actualización pendiente', 'Cancelación confirmada; actualiza Mis retiros para consultar la lista.');
      });
    } catch (error) {
      if (cancelRevision !== pickupCancelRevisionRef.current) return;
      try {
        const authResult = await supabase.auth.getSession();
        if (authResult.error) throw authResult.error;
        if (cancelRevision !== pickupCancelRevisionRef.current || authResult.data.session?.user?.id !== requestedBy) return;
      } catch (authError) {
        if (cancelRevision !== pickupCancelRevisionRef.current) return;
        message('Resultado de cancelación pendiente',
          'No fue posible verificar la sesión. Consulta tu cuenta y Mis retiros antes de repetir la cancelación.');
        return;
      }
      if (cancelRevision !== pickupCancelRevisionRef.current) return;
      message('Resultado de cancelación no confirmado',
        (error.message || 'Error de conexión') +
        '\nLa cancelación pudo haberse procesado. Consulta Mis retiros antes de repetirla.');
    } finally {
      if (cancelRevision === pickupCancelRevisionRef.current) setPickupCancelBusy(false);
    }
  }

  function navigate(to) {
    setScreen(to);
    if (to === 'Convertir') loadSwapWallet();
    if (to === 'MisRetiros') loadPickupOrders();
    // Conservar una solicitud de transferencia incierta al navegar.
    // Solo se descarta si cambian importe/destinatario, usuario o se confirma.
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
                value={pickupAmount} onChangeText={value => { setPickupAmount(value); pickupPendingRef.current = null; }} editable={!pickupBusy} />
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
                  swapQuoteRevisionRef.current += 1;
                  setSwapQuote(null);
                }} />
              <TextInput style={styles.input} placeholder="Cantidad (mínimo 1)"
                keyboardType="decimal-pad" placeholderTextColor="#9fb1c8"
                value={swapAmount} editable={!swapBusy} onChangeText={value => { swapQuoteRevisionRef.current += 1; setSwapAmount(value); setSwapQuote(null); }} />
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
