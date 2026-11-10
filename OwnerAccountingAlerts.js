// Panel de auditoría de MWD — solo datos ficticios.
// Componente independiente para integrar después en la pantalla Admin.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';

export default function OwnerAccountingAlerts({ supabase, isOwner }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isOwner || loading) return;
    setLoading(true);
    setError('');
    try {
      const { data: result, error: rpcError } = await supabase.rpc('mwd_owner_accounting_alerts_demo');
      if (rpcError) throw rpcError;
      if (!result || result.mode !== 'sandbox_only' || result.realPaymentsEnabled !== false) {
        throw new Error('Respuesta de auditoría inesperada');
      }
      setData(result);
    } catch (e) {
      setData(null);
      setError('No se pudo consultar la auditoría. Verifica tu sesión de propietario.');
    } finally {
      setLoading(false);
    }
  }, [supabase, isOwner, loading]);

  if (!isOwner) return null;
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Auditoría contable — DEMO</Text>
      <Text>Solo créditos ficticios. Sin dinero real.</Text>
      <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={refresh} style={styles.button}>
        <Text style={styles.buttonText}>Actualizar auditoría</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator accessibilityLabel="Consultando auditoría" /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {data ? (
        <View>
          <Text>Billeteras revisadas: {data.walletsChecked}</Text>
          <Text>Alertas de billeteras: {data.walletAlerts}</Text>
          <Text>Transferencias revisadas: {data.transfersChecked}</Text>
          <Text>Alertas contables: {data.ledgerAlerts}</Text>
          <Text>Estado: {data.status === 'ok' ? 'Sin diferencias detectadas' : 'Revisión necesaria'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderWidth: 1, borderColor: '#b9c4d0', borderRadius: 12, marginVertical: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  button: { backgroundColor: '#174b75', padding: 12, borderRadius: 8, marginVertical: 12 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  error: { color: '#9c1b1b', marginVertical: 8 },
});
