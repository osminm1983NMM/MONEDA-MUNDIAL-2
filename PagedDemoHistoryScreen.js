// Historial adicional MWD de solo lectura. Nunca envía transferencias ni modifica saldos.
import React, {useEffect, useRef, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {loadMyDemoHistory} from './src/demo-history-readonly.mjs';
import {formatLocalizedDate} from './src/i18n.mjs';
import {verifiedPagedMerchantDirection} from './src/demo-history-view.mjs';

const PAGE_SIZE = 20;

const COPY = {
  es: {
    expand: 'Ver historial completo de prueba', collapse: 'Ocultar historial completo',
    loading: 'Consultando movimientos de tu cuenta...', empty: 'Sin movimientos en esta página.',
    error: 'No se pudo verificar tu historial. Vuelve a intentarlo.',
    sent: 'Enviado', received: 'Recibido', contribution: 'Aportación',
    merchantSent: 'Pago ficticio a comercio', merchantReceived: 'Cobro ficticio de comercio',
    previous: 'Anterior', next: 'Siguiente', page: 'Página', retry: 'Reintentar',
    warning: 'Créditos MWD ficticios. No es un comprobante de dinero real.',
  },
  en: {
    expand: 'View full demo history', collapse: 'Hide full history',
    loading: 'Loading your account activity...', empty: 'No transactions on this page.',
    error: 'Could not verify your history. Please try again.',
    sent: 'Sent', received: 'Received', contribution: 'Contribution',
    merchantSent: 'Demo merchant payment', merchantReceived: 'Demo merchant collection',
    previous: 'Previous', next: 'Next', page: 'Page', retry: 'Retry',
    warning: 'Fictitious MWD credits. Not proof of real-money payment.',
  },
};

function OperationLabel({item, t, language, recentOperations, userId}) {
  const verifiedMerchant = verifiedPagedMerchantDirection(item, recentOperations, userId);
  const title = verifiedMerchant ? t[verifiedMerchant]
    : item.direction === 'enviado' ? t.sent
    : item.direction === 'recibido' ? t.received : t.contribution;
  const sign = item.direction === 'recibido' ? '+' : '−';
  return (
    <View style={styles.entry}>
      <Text style={styles.entryTitle}>{title}</Text>
      <Text style={styles.amount}>{sign}{item.amountMwd} MWD</Text>
      <Text style={styles.muted}>{item.createdAt ? formatLocalizedDate(item.createdAt, language) : ''}</Text>
    </View>
  );
}

/**
 * Mantiene el historial existente de App.js intacto. La consulta adicional se
 * inicia únicamente cuando el usuario expande esta sección.
 *
 * El servidor aplica RLS. Además, cada petición se vincula al usuario y al
 * número de secuencia para no mostrar respuestas de otra sesión o pantalla.
 */
export default function PagedDemoHistoryScreen({supabase, userId, language = 'es', recentOperations = [], refreshTick = 0}) {
  const t = COPY[language] || COPY.es;
  const requestSequence = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    requestSequence.current += 1;
    setExpanded(false);
    setPage(0);
    setRows([]);
    setTotal(null);
    setError(false);
  }, [userId]);

  useEffect(() => {
    const current = ++requestSequence.current;
    if (!expanded || !userId) return () => {requestSequence.current += 1;};
    setRows([]); // No mostrar historia obsoleta durante la carga.
    setTotal(null);
    setError(false);
    setLoading(true);
    loadMyDemoHistory(supabase, {page, pageSize: PAGE_SIZE})
      .then(result => {
        if (requestSequence.current !== current) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch(() => {
        if (requestSequence.current !== current) return;
        setRows([]);
        setError(true);
      })
      .finally(() => {
        if (requestSequence.current === current) setLoading(false);
      });
    return () => {requestSequence.current += 1;};
  }, [expanded, page, userId, supabase, retry, refreshTick]);

  function toggle() {
    setExpanded(value => !value);
    setPage(0);
    setRows([]);
    setTotal(null);
  }

  const canNext = !loading && !error && (total === null
    ? rows.length === PAGE_SIZE
    : (page + 1) * PAGE_SIZE < total);

  return (
    <View style={styles.panel}>
      <TouchableOpacity accessibilityRole="button" onPress={toggle} style={styles.button}>
        <Text style={styles.buttonText}>{expanded ? t.collapse : t.expand}</Text>
      </TouchableOpacity>
      {expanded && <View>
        <Text style={styles.warning}>{t.warning}</Text>
        {loading && <Text style={styles.muted}>{t.loading}</Text>}
        {error && <>
          <Text style={styles.error}>{t.error}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button}
            onPress={() => setRetry(v => v + 1)}>
            <Text style={styles.buttonText}>{t.retry}</Text>
          </TouchableOpacity>
        </>}
        {!loading && !error && rows.length === 0 &&
          <Text style={styles.muted}>{t.empty}</Text>}
        {!loading && !error && rows.map(item => <OperationLabel key={item.id} item={item}
          t={t} language={language} recentOperations={recentOperations} userId={userId} />)}
        {!error && <View style={styles.navigation}>
          <TouchableOpacity accessibilityRole="button" style={[styles.smallButton, (page === 0 || loading) && styles.disabled]}
            disabled={page === 0 || loading} onPress={() => setPage(value => Math.max(0, value - 1))}>
            <Text style={styles.buttonText}>{t.previous}</Text>
          </TouchableOpacity>
          <Text style={styles.muted}>{t.page} {page + 1}</Text>
          <TouchableOpacity accessibilityRole="button" style={[styles.smallButton, !canNext && styles.disabled]}
            disabled={!canNext} onPress={() => setPage(value => value + 1)}>
            <Text style={styles.buttonText}>{t.next}</Text>
          </TouchableOpacity>
        </View>}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {backgroundColor: '#102840', borderRadius: 12, padding: 14, marginVertical: 10},
  button: {backgroundColor: '#1b6686', borderRadius: 10, padding: 12, alignItems: 'center'},
  buttonText: {color: '#ffffff', fontWeight: '700'},
  warning: {color: '#e8c982', fontSize: 12, marginVertical: 10},
  muted: {color: '#b2c6d8', fontSize: 12, marginVertical: 7},
  error: {color: '#ffbca6', marginVertical: 8},
  entry: {borderBottomWidth: 1, borderBottomColor: '#36526a', paddingVertical: 11},
  entryTitle: {color: '#f5fbff', fontWeight: '700'},
  amount: {color: '#58e5c0', fontSize: 17, fontWeight: '700', marginTop: 3},
  navigation: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14},
  smallButton: {backgroundColor: '#1b6686', borderRadius: 9, padding: 10},
  disabled: {opacity: 0.35},
});
