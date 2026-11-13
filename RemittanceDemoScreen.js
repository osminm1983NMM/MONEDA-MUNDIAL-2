// Remesas ficticias US -> HN. Solo propietario; nunca mueve dinero real.
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const parseCents = raw => {
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [dollars, fraction = ''] = value.split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 10000000 ? cents : null;
};

const uuid = () => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Generador seguro no disponible');
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
};

export default function RemittanceDemoScreen({ supabase, adminRole }) {
  const [amount, setAmount] = useState('100.00');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [order, setOrder] = useState(null);
  const pendingCreate = useRef(null);
  const pendingTransition = useRef(null);
  const [notice, setNotice] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);

  async function create(cents) {
    if (order || !Number.isSafeInteger(cents) || cents < 100 || cents > 10000000 || busyRef.current) return;
    if (pendingCreate.current && pendingCreate.current.cents !== cents) {
      Alert.alert('Solicitud pendiente', 'Hay una creación sin confirmar. Reintenta con el mismo monto para evitar duplicados.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (!pendingCreate.current)
        pendingCreate.current = { cents, requestId: uuid() };
      const { data, error } = await supabase.rpc('mwd_owner_remittance_create_demo', {
        p_destination_country: 'HN',
        p_amount_cents: cents,
        p_request_id: pendingCreate.current.requestId
      });
      if (error) throw error;
      if (!data?.id || !['draft', 'review', 'simulated', 'cancelled'].includes(data.status))
        throw new Error('Respuesta de creación no reconocida.');
      setOrder({ id: data.id, status: data.status });
      setRecentOrders([]);
      pendingCreate.current = null;
      pendingTransition.current = null;
      setNotice(data.already_processed ? 'Solicitud ya registrada.' : 'Borrador ficticio creado.');
    } catch (e) {
      Alert.alert('Creación no confirmada', e.message || 'Reintenta sin cambiar el monto.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function transition(next) {
    if (!order || busyRef.current || !(
      (order.status === 'draft' && ['review', 'cancelled'].includes(next)) ||
      (order.status === 'review' && ['simulated', 'cancelled'].includes(next))
    )) return;
    if (pendingTransition.current &&
        (pendingTransition.current.id !== order.id || pendingTransition.current.next !== next)) {
      Alert.alert('Cambio pendiente', 'Existe un cambio de estado sin confirmar. Reintenta primero la misma acción para evitar resultados contradictorios.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (!pendingTransition.current)
        pendingTransition.current = { id: order.id, next, requestId: uuid() };
      const { data, error } = await supabase.rpc('mwd_owner_remittance_transition_demo', {
        p_order_id: order.id,
        p_new_status: next,
        p_request_id: pendingTransition.current.requestId
      });
      if (error) throw error;
      if (!data || data.id !== order.id || !['draft', 'review', 'simulated', 'cancelled'].includes(data.status))
        throw new Error('Respuesta de transición no reconocida.');
      setOrder({ id: data.id, status: data.status });
      pendingTransition.current = null;
      setNotice(data.already_processed ? 'Reintento reconocido.' : 'Estado actualizado.');
    } catch (e) {
      Alert.alert('Cambio no confirmado', e.message || 'Revisa el estado antes de continuar.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function loadRecent() {
    if (busyRef.current || adminRole !== 'owner') return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_owner_remittances_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de consulta no reconocida.');
      const valid = data.filter(item => item && typeof item.id === 'string' &&
        ['draft', 'review', 'simulated', 'cancelled'].includes(item.status) &&
        Number.isSafeInteger(Number(item.amount_cents)) &&
        Number(item.amount_cents) >= 100 && Number(item.amount_cents) <= 10000000);
      setRecentOrders(valid.slice(0, 10));
      setNotice('Consulta ficticia actualizada desde el servidor.');
    } catch (e) {
      Alert.alert('No se pudo consultar', e.message || 'Comprueba tu conexión.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function refreshSelected() {
    if (!order || busyRef.current || pendingTransition.current || pendingCreate.current) {
      Alert.alert('Operación pendiente', 'Resuelve primero cualquier solicitud sin confirmar.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_owner_remittances_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Respuesta de consulta no reconocida.');
      const current = data.find(item => item?.id === order.id);
      if (!current || !['draft', 'review', 'simulated', 'cancelled'].includes(current.status)) {
        throw new Error('No se encontró esta orden entre las órdenes recientes. No se modificó.');
      }
      setOrder({ id: current.id, status: current.status });
      setNotice('Estado verificado con el servidor.');
    } catch (e) {
      Alert.alert('No se pudo actualizar', e.message || 'Comprueba tu conexión.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function selectRecent(item) {
    if (busyRef.current || pendingCreate.current || pendingTransition.current) {
      Alert.alert('Solicitud sin confirmar', 'Resuelve primero la operación pendiente en esta pantalla.');
      return;
    }
    setOrder({ id: item.id, status: item.status });
    setRecentOrders([]);
    setNotice('Orden recuperada desde el servidor.');
  }

  const ask = (next, label) => {
    const confirmedOrderId = order?.id;
    const confirmedStatus = order?.status;
    Alert.alert('Remesa ficticia', label + '. No se mueve dinero real.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', onPress: () => {
        if (!confirmedOrderId || order?.id !== confirmedOrderId || order?.status !== confirmedStatus) {
          Alert.alert('Confirmación vencida', 'El estado de la orden cambió. Revisa antes de confirmar.');
          return;
        }
        transition(next);
      } }
    ]);
  };
  const button = (label, onPress) => (
    <TouchableOpacity disabled={busy} onPress={onPress} style={[styles.button, busy && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  if (adminRole !== 'owner') return <Text style={styles.text}>Acceso reservado al propietario.</Text>;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Remesa internacional · DEMO</Text>
      <Text style={styles.warn}>Sin dinero real, sin entrega y sin débito MWD</Text>
      <Text style={styles.text}>Origen: Estados Unidos (US)</Text>
      <Text style={styles.text}>Destino: Honduras (HN)</Text>
      {!order ? (
        <>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={amount}
            onChangeText={setAmount} editable={!busy} placeholder="Monto ficticio USD" placeholderTextColor="#a6b7ce" />
          {button('Crear borrador de $' + amount + ' ficticios', () => {
            const cents = parseCents(amount);
            if (cents === null) {
              Alert.alert('Monto inválido', 'Entre $1 y $100,000 ficticios.');
              return;
            }
            Alert.alert('Crear borrador', 'Registrar remesa ficticia de $' + (cents / 100).toFixed(2) + ' hacia Honduras?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Crear', onPress: () => create(cents) }
            ]);
          })}
        </>
      ) : (
        <>
          <Text style={styles.text}>Estado: {order.status}</Text>
          <Text selectable style={styles.text}>Referencia: {order.id}</Text>
          {button('Actualizar estado desde el servidor', refreshSelected)}
          {order.status === 'draft' && button('Enviar a revisión', () => ask('review', 'Pasar a revisión'))}
          {order.status === 'review' && button('Completar simulación', () => ask('simulated', 'Completar simulación'))}
          {['draft', 'review'].includes(order.status) && button('Cancelar simulación', () => ask('cancelled', 'Cancelar orden'))}
          {['simulated', 'cancelled'].includes(order.status) && button('Preparar otra prueba', () => {
            setOrder(null);
            setNotice('');
          })}
        </>
      )}
      {!order && button('Consultar remesas ficticias recientes', loadRecent)}
      {!order && recentOrders.map(item => (
        <TouchableOpacity key={item.id} disabled={busy} onPress={() => selectRecent(item)}
          style={[styles.button, busy && styles.disabled]}>
          <Text style={styles.buttonText}>
            {item.destination_country} · ${(Number(item.amount_cents) / 100).toFixed(2)} · {item.status}
          </Text>
          <Text style={styles.buttonText}>{item.id.slice(0, 8)}</Text>
        </TouchableOpacity>
      ))}
      {!!notice && <Text style={styles.text}>{notice}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#13253e', padding: 20, borderRadius: 16, marginVertical: 12 },
  title: { color: '#fff', fontWeight: '700', fontSize: 20, marginBottom: 12 },
  warn: { color: '#f4cc81', marginBottom: 12 },
  text: { color: '#d4e0f1', marginVertical: 6 },
  input: { backgroundColor: '#233a58', color: '#fff', padding: 14, borderRadius: 10, marginVertical: 12 },
  button: { backgroundColor: '#276af1', padding: 15, borderRadius: 10, marginVertical: 7 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' }
});
