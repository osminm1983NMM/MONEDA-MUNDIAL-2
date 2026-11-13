// Remesas internacionales de demostración: SOLO propietario, SIN dinero real.
// Componente independiente; integrar en App.js después de revisión.
import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';

const parseCents = raw => {
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 100 && cents <= 10000000 ? cents : null;
};
const uuid = () => {
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error('Generador seguro no disponible');
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
};
export default function RemittanceDemoScreen({ supabase, adminRole }) {
  const [amount, setAmount] = useState('100.00');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const pendingCreate = useRef(null);
  const pendingTransition = useRef(null);
  const [notice, setNotice] = useState('');
  if (adminRole !== 'owner') return <Text style={styles.text}>Acceso reservado al propietario.</Text>;
  async function create() {
    const cents = parseCents(amount);
    if (cents === null) return Alert.alert('Monto inválido', 'Entre $1 y $100,000 ficticios.');
    if (busy) return;
    setBusy(true);
    try {
      if (!pendingCreate.current || pendingCreate.current.cents !== cents)
        pendingCreate.current = { cents, requestId: uuid() };
      const { data, error } = await supabase.rpc('mwd_owner_remittance_create_demo', {
        p_destination_country: 'HN', p_amount_cents: cents,
        p_request_id: pendingCreate.current.requestId
      });
      if (error) throw error;
      if (!data?.id) throw new Error('No se recibió identificador de orden.');
      setOrder({ id: data.id, status: data.status });
      pendingCreate.current = null;
      pendingTransition.current = null;
      setNotice(data.already_processed ? 'Solicitud ya registrada.' : 'Borrador de remesa creado.');
    } catch (e) { Alert.alert('Creación no confirmada', e.message || 'Reintenta sin cambiar el monto.'); }
    finally { setBusy(false); }
  }
  async function transition(next) {
    if (!order || busy) return;
    setBusy(true);
    try {
      if (!pendingTransition.current || pendingTransition.current.id !== order.id ||
          pendingTransition.current.next !== next)
        pendingTransition.current = { id: order.id, next, requestId: uuid() };
      const { data, error } = await supabase.rpc('mwd_owner_remittance_transition_demo', {
        p_order_id: order.id, p_new_status: next,
        p_request_id: pendingTransition.current.requestId
      });
      if (error) throw error;
      setOrder(prev => ({ ...prev, status: data.status }));
      pendingTransition.current = null;
      setNotice(data.already_processed ? 'Reintento reconocido.' : 'Estado actualizado.');
    } catch (e) { Alert.alert('Cambio no confirmado', e.message || 'Revisa el estado antes de continuar.'); }
    finally { setBusy(false); }
  }
  const ask = (next, label) => Alert.alert('Remesa ficticia', label + '. No se mueve dinero real.', [
    { text: 'Volver', style: 'cancel' }, { text: 'Confirmar', onPress: () => transition(next) }
  ]);
  const btn = (label, action) => <TouchableOpacity disabled={busy} onPress={action} style={[styles.button,busy && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
  return <View style={styles.card}>
    <Text style={styles.title}>Remesa internacional · DEMO</Text>
    <Text style={styles.warn}>Sin dinero real, sin entrega y sin débito MWD</Text>
    <Text style={styles.text}>Origen: Estados Unidos (US)</Text>
    <Text style={styles.text}>Destino: Honduras (HN)</Text>
    {!order ? <>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={amount}
        onChangeText={setAmount} editable={!busy} placeholder="Monto ficticio USD" placeholderTextColor="#a6b7ce" />
      {btn('Crear borrador de $' + amount + ' ficticios', () =>
        Alert.alert('Crear borrador', 'Registrar remesa ficticia hacia Honduras?', [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Crear', onPress: create }
        ]))}
    </> : <>
      <Text style={styles.text}>Estado: {order.status}</Text>
      <Text selectable style={styles.text}>Referencia: {order.id}</Text>
      {order.status === 'draft' && btn('Enviar a revisión', () => ask('review','Pasar a revisión'))}
      {order.status === 'review' && btn('Completar simulación', () => ask('simulated','Completar simulación'))}
      {['draft','review'].includes(order.status) && btn('Cancelar simulación', () => ask('cancelled','Cancelar orden'))}
      {['simulated','cancelled'].includes(order.status) && btn('Preparar otra prueba', () => { setOrder(null); setNotice(''); })}
    </>}
    {!!notice && <Text style={styles.text}>{notice}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  card:{backgroundColor:'#13253e',padding:20,borderRadius:16,marginVertical:12},
  title:{color:'#fff',fontWeight:'700',fontSize:20,marginBottom:12},
  warn:{color:'#f4cc81',marginBottom:12},
  text:{color:'#d4e0f1',marginVertical:6},
  input:{backgroundColor:'#233a58',color:'#fff',padding:14,borderRadius:10,marginVertical:12},
  button:{backgroundColor:'#276af1',padding:15,borderRadius:10,marginVertical:7},
  disabled:{opacity:0.5},buttonText:{color:'#fff',textAlign:'center',fontWeight:'700'}
});
