// Resumen de balances SIMULADOS; separado del saldo MWD de la cuenta.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { parseDemoAssetBalances, formatDemoMicro } from './src/digital-money/demo-asset-summary.mjs';

const style = {
  panel: { backgroundColor: '#13253e', borderRadius: 17, padding: 20, marginBottom: 17 },
  heading: { color: '#fff', fontSize: 19, fontWeight: '700', marginBottom: 8 },
  description: { color: '#9ab0cf', lineHeight: 21, marginBottom: 8 },
  amount: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 7 },
  warning: { color: '#f4cc81', lineHeight: 19, marginVertical: 8 },
  button: { backgroundColor: '#334b68', padding: 14, borderRadius: 11, marginTop: 7 },
  buttonText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
};

export default function DemoAssetSummaryCard({ supabase, onOpenConversion }) {
  const [balances, setBalances] = useState(null);
  const [state, setState] = useState('loading');
  const mounted = useRef(false);
  const request = useRef(0);

  const reload = useCallback(async () => {
    const ticket = ++request.current;
    setState('loading');
    setBalances(null); // Never show stale balances while refreshing.
    try {
      const { data, error } = await supabase.rpc('mwd_conversion_wallet_demo');
      if (error) throw error;
      const parsed = parseDemoAssetBalances(data);
      if (!parsed) throw new Error('Sandbox response did not match contract');
      if (mounted.current && ticket === request.current) {
        setBalances(parsed);
        setState('ready');
      }
    } catch (_) {
      if (mounted.current && ticket === request.current) {
        setBalances(null);
        setState('error');
      }
    }
  }, [supabase]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; request.current += 1; };
  }, [reload]);

  return <View style={style.panel}>
    <Text style={style.heading}>Moneda Mundial Coin y Digital</Text>
    <Text style={style.warning}>SOLO DEMOSTRACIÓN · Saldos ficticios separados de MWD. No se suman, no son USD ni representan activos emitidos.</Text>
    {state === 'loading' && <Text style={style.description}>Consultando saldos ficticios...</Text>}
    {state === 'error' && <Text style={style.warning}>Los saldos de Coin y Digital no están disponibles. No se muestra un saldo estimado.</Text>}
    {state === 'ready' && balances && <>
      <Text style={style.amount}>Moneda Mundial Coin: {formatDemoMicro(balances.coinMicro)} COIN</Text>
      <Text style={style.amount}>Moneda Mundial Digital: {formatDemoMicro(balances.stableMicro)} STABLE</Text>
      <Text style={style.description}>Digital es una simulación; no tiene reservas, paridad garantizada ni posibilidad de retiro.</Text>
    </>}
    <TouchableOpacity accessibilityRole="button" disabled={state === 'loading'}
      accessibilityLabel="Actualizar saldos ficticios Coin y Digital"
      style={[style.button, state === 'loading' && { opacity: 0.5 }]} onPress={reload}>
      <Text style={style.buttonText}>Actualizar saldos Coin y Digital</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir conversión ficticia Coin y Digital"
      style={style.button} onPress={onOpenConversion}>
      <Text style={style.buttonText}>Convertir Coin ↔ Digital (prueba)</Text>
    </TouchableOpacity>
  </View>;
}
