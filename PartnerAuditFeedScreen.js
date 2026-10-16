// Panel de auditoría persistente y de solo lectura, exclusivo del propietario.
// La RPC valida el rol en PostgreSQL y nunca devuelve JSON interno de auditoría.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

const COUNTRIES = [
  { id: null, label: 'Todos' },
  { id: 'HN', label: 'Honduras' },
  { id: 'NI', label: 'Nicaragua' },
];
const styles = {
  box: { backgroundColor: '#182d46', padding: 14, borderRadius: 12, marginTop: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { color: '#b7cee5', lineHeight: 20, marginBottom: 8 },
  warn: { color: '#ffbd9d', marginVertical: 7 },
  button: { padding: 10, backgroundColor: '#304a67', borderRadius: 8, marginBottom: 7 },
  activeButton: { backgroundColor: '#276af1' },
  buttonText: { color: '#fff', fontWeight: '700' },
  entry: { paddingVertical: 12, borderTopWidth: 1, borderColor: '#39516e' },
  item: { color: '#ecf2ff', marginBottom: 4 },
  dim: { color: '#b2c8e0', fontSize: 12 },
};
const ACTIONS = { INSERT: 'Alta', UPDATE: 'Modificación', DELETE: 'Eliminación' };
const ENTITIES = { partners: 'Institución', locations: 'Sucursal' };

function FilterButton({ label, active, onPress }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress}
    style={[styles.button, active && styles.activeButton]}>
    <Text style={styles.buttonText}>{active ? '✓ ' : ''}{label}</Text>
  </TouchableOpacity>;
}

export default function PartnerAuditFeedScreen({ supabase, partners = [] }) {
  const [country, setCountry] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const visiblePartners = useMemo(
    () => partners.filter(p => !country || p.country_code === country),
    [partners, country]
  );

  useEffect(() => {
    let active = true;
    setEvents([]);
    setError('');
    setLoading(true);
    supabase.rpc('mwd_owner_partner_audit_feed_demo', {
      p_country_code: country,
      p_partner_id: partnerId,
      p_limit: 50,
    }).then(({ data, error: dbError }) => {
      if (!active) return;
      if (dbError) setError(dbError.message || 'No se pudo consultar la auditoría.');
      else setEvents(data || []);
    }).catch(err => {
      if (active) setError(err?.message || 'No se pudo consultar la auditoría.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase, country, partnerId, revision]);

  function chooseCountry(next) {
    setPartnerId(null);
    setCountry(next);
  }

  return <View style={styles.box}>
    <Text style={styles.title}>Historial general de auditoría</Text>
    <Text style={styles.label}>
      Registro permanente de cambios de instituciones y sucursales candidatas.
      Consulta de solo lectura; nunca habilita pagos reales.
    </Text>
    <Text style={styles.label}>Filtrar por país</Text>
    {COUNTRIES.map(c => <FilterButton key={c.id || 'all'} label={c.label}
      active={country === c.id} onPress={() => chooseCountry(c.id)} />)}
    <Text style={styles.label}>Filtrar por institución</Text>
    <FilterButton label="Todas las instituciones"
      active={!partnerId} onPress={() => setPartnerId(null)} />
    {visiblePartners.map(p => <FilterButton key={p.id}
      label={p.legal_name + ' · ' + p.country_code}
      active={partnerId === p.id} onPress={() => setPartnerId(p.id)} />)}
    <FilterButton label="Actualizar historial" active={false}
      onPress={() => setRevision(n => n + 1)} />
    {loading && <ActivityIndicator color="#99c4ff" />}
    {!!error && <Text style={styles.warn}>{error}</Text>}
    {!loading && !error && events.length === 0 &&
      <Text style={styles.label}>No hay cambios registrados para este filtro.</Text>}
    {!loading && !error && events.map(e => <View key={String(e.audit_id)} style={styles.entry}>
      <Text style={styles.item}>
        {e.partner_name} ({e.country_code}) — {ENTITIES[e.entity_type] || e.entity_type}
      </Text>
      <Text style={styles.item}>
        {ACTIONS[String(e.action).toUpperCase()] || e.action}
      </Text>
      <Text style={styles.dim}>{new Date(e.changed_at).toLocaleString()}</Text>
      <Text style={styles.dim}>Operador: {e.actor_id ? String(e.actor_id).slice(0, 8) + '…' : 'No identificado'}</Text>
    </View>)}
    <Text style={styles.dim}>Solo últimos 50 eventos por consulta. No se muestran documentos ni datos bancarios.</Text>
  </View>;
}
