// Registro permanente de candidatos a socios financieros (solo modo demostración).
// Las llamadas RPC comprueban el rol propietario en Supabase; ocultar esta pantalla no es una barrera de seguridad.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';

const KIND = [
  ['bank', 'Banco'],
  ['remittance_company', 'Remesadora'],
  ['agent_network', 'Red de agentes'],
  ['payment_institution', 'Institución de pagos'],
];
const LABELS = {
  draft: 'Borrador',
  under_review: 'En revisión',
  needs_changes: 'Requiere ajustes',
  documented: 'Documentación revisada (NO autorizado)',
  archived: 'Archivado',
};
const NEXT = {
  draft: [['under_review', 'Enviar a revisión']],
  needs_changes: [['under_review', 'Reenviar a revisión']],
  under_review: [['needs_changes', 'Solicitar ajustes'], ['documented', 'Marcar documentación revisada']],
  documented: [['archived', 'Archivar registro']],
  archived: [],
};

const s = {
  card: { backgroundColor: '#182d46', padding: 14, borderRadius: 12, marginBottom: 12 },
  input: { backgroundColor: '#233a58', color: '#fff', padding: 12, borderRadius: 9, marginVertical: 5, fontSize: 15 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  text: { color: '#d4e0f1', marginVertical: 5, lineHeight: 20 },
  dim: { color: '#a9bed4', marginVertical: 5 },
  warn: { color: '#ffda92', marginVertical: 8, lineHeight: 20 },
  button: { backgroundColor: '#2867df', padding: 11, borderRadius: 9, marginVertical: 5 },
  secondary: { backgroundColor: '#3b526e' },
  buttonText: { color: 'white', fontWeight: '700', textAlign: 'center' },
};

function Btn({ title, onPress, secondary, disabled }) {
  return <TouchableOpacity accessibilityRole="button" disabled={disabled}
    style={[s.button, secondary && s.secondary, disabled && { opacity: 0.45 }]}
    onPress={onPress}><Text style={s.buttonText}>{title}</Text></TouchableOpacity>;
}

function Field({ label, value, onChangeText, placeholder, editable = true }) {
  return <View><Text style={s.text}>{label}</Text><TextInput
    accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText}
    autoCorrect={false} editable={editable} placeholder={placeholder} placeholderTextColor="#b3c5d9" /></View>;
}

export default function PartnerRegistryScreen({ supabase }) {
  const [partners, setPartners] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('bank');
  const [country, setCountry] = useState('NI');
  const [branchName, setBranchName] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const partnersLoadVersionRef = useRef(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = partners.find(p => p.id === selectedId);
  function beginBusy() {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  }
  function endBusy() {
    busyRef.current = false;
    setBusy(false);
  }
  async function request(name, params) {
    const { data, error: dbError } = await supabase.rpc(name, params);
    if (dbError) throw dbError;
    return data;
  }
  function report(err) {
    setError(err?.message || 'No se pudo completar la operación.');
    setNotice('');
  }
  async function reloadPartners() {
    const requestVersion = ++partnersLoadVersionRef.current;
    const rows = await request('mwd_owner_partners_demo');
    if (requestVersion === partnersLoadVersionRef.current) setPartners(rows || []);
  }
  async function reloadDetails(id) {
    setLocations([]);
    setAudit([]);
    if (!id) return;
    const [loc, hist] = await Promise.all([
      request('mwd_owner_partner_locations_demo', { p_partner_id: id }),
      request('mwd_owner_partner_audit_demo', { p_partner_id: id }),
    ]);
    setLocations(loc || []);
    setAudit(hist || []);
  }
  useEffect(() => {
    let active = true;
    const requestVersion = ++partnersLoadVersionRef.current;
    supabase.rpc('mwd_owner_partners_demo').then(({ data, error: dbError }) => {
      if (!active || requestVersion !== partnersLoadVersionRef.current) return;
      if (dbError) report(dbError);
      else setPartners(data || []);
    }).catch(err => {
      if (active && requestVersion === partnersLoadVersionRef.current) report(err);
    });
    return () => { active = false; };
  }, [supabase]);

  async function savePartner() {
    if (!beginBusy()) return;
    setError(''); setNotice('');
    try {
      const result = await request('mwd_owner_partner_save_demo', {
        p_legal_name: name.trim(),
        p_partner_kind: kind,
        p_country_code: country.trim().toUpperCase(),
      });
      await reloadPartners();
      setSelectedId(result.id);
      await reloadDetails(result.id);
      setName('');
      setNotice('Candidato guardado permanentemente como borrador; sin capacidad de pagar remesas.');
    } catch (err) { report(err); }
    finally { endBusy(); }
  }
  async function choosePartner(id) {
    if (!beginBusy()) return;
    setSelectedId(id); setError(''); setNotice('');
    try { await reloadDetails(id); }
    catch (err) { report(err); }
    finally { endBusy(); }
  }
  async function setStatus(status) {
    if (!selectedId || busy) return;
    if (!beginBusy()) return;
    setError(''); setNotice('');
    try {
      await request('mwd_owner_partner_set_status_demo', {
        p_partner_id: selectedId, p_new_status: status,
      });
      await reloadPartners(); await reloadDetails(selectedId);
      setNotice('Estado de revisión guardado. No habilita retiros ni pagos reales.');
    } catch (err) { report(err); }
    finally { endBusy(); }
  }
  async function saveLocation() {
    if (!selectedId || busy) return;
    if (!beginBusy()) return;
    setError(''); setNotice('');
    try {
      await request('mwd_owner_partner_location_save_demo', {
        p_partner_id: selectedId,
        p_display_name: branchName.trim(),
        p_city: city.trim(),
        p_currency_code: currency.trim().toUpperCase(),
        p_hours_note: hours.trim() || null,
      });
      await reloadDetails(selectedId);
      setBranchName(''); setCity(''); setHours('');
      setNotice('Sucursal candidata guardada. No es un punto de retiro autorizado.');
    } catch (err) { report(err); }
    finally { endBusy(); }
  }

  return <View>
    <Text style={s.warn}>REGISTRO INTERNO • SOLO PLANIFICACIÓN. Ningún banco o agente de esta sección está autorizado para pagar. No introduzcas contraseñas, documentos de identidad ni datos bancarios.</Text>
    {!!error && <Text style={[s.warn, { color: '#ff9494' }]}>{error}</Text>}
    {!!notice && <Text style={[s.text, { color: '#9cf0b3' }]}>{notice}</Text>}
    {busy && <ActivityIndicator color="#99c4ff" />}

    <View style={s.card}>
      <Text style={s.title}>Registrar futuro socio</Text>
      <Field label="Nombre de la entidad" value={name} onChangeText={setName} placeholder="Nombre legal de ejemplo o candidato" editable={!busy} />
      <Field label="País (código de 2 letras)" value={country} onChangeText={setCountry} placeholder="NI, CR, HN..." editable={!busy} />
      <Text style={s.text}>Tipo de entidad</Text>
      {KIND.map(([value, label]) => <Btn key={value}
        title={kind === value ? '✓ ' + label : label}
        secondary={kind !== value} disabled={busy} onPress={() => setKind(value)} />)}
      <Btn title="Guardar borrador permanente" disabled={busy || !name.trim() || country.trim().length !== 2} onPress={savePartner} />
    </View>

    <View style={s.card}>
      <Text style={s.title}>Candidatos registrados ({partners.length})</Text>
      {partners.length === 0 && <Text style={s.dim}>Aún no existen registros permanentes.</Text>}
      {partners.map(p => <Btn key={p.id}
        title={(selectedId === p.id ? '✓ ' : '') + p.legal_name + ' · ' + p.country_code + '\n' + (LABELS[p.review_status] || p.review_status)}
        secondary={selectedId !== p.id} disabled={busy} onPress={() => choosePartner(p.id)} />)}
      <Btn title="Actualizar listado" secondary disabled={busy} onPress={async () => {
        if (!beginBusy()) return;
        setError('');
        try { await reloadPartners(); } catch (err) { report(err); }
        finally { endBusy(); }
      }} />
    </View>

    {selected && <View style={s.card}>
      <Text style={s.title}>{selected.legal_name}</Text>
      <Text style={s.dim}>Estado: {LABELS[selected.review_status] || selected.review_status}</Text>
      <Text style={s.warn}>“Documentación revisada” no equivale a licencia, contrato ni autorización operativa.</Text>
      {(NEXT[selected.review_status] || []).map(([status, label]) =>
        <Btn key={status} title={label} secondary disabled={busy} onPress={() => setStatus(status)} />)}

      <Text style={[s.title, { marginTop: 17 }]}>Sucursales candidatas</Text>
      {locations.map(l => <Text key={l.id} style={s.text}>
        {l.display_name} — {l.city} — {l.currency_code} · Borrador
      </Text>)}
      <Field label="Nombre de sucursal" value={branchName} onChangeText={setBranchName} editable={!busy} />
      <Field label="Ciudad" value={city} onChangeText={setCity} editable={!busy} />
      <Field label="Moneda de referencia (3 letras)" value={currency} onChangeText={setCurrency} editable={!busy} />
      <Field label="Horario orientativo (opcional)" value={hours} onChangeText={setHours} editable={!busy} />
      <Btn title="Guardar sucursal candidata" disabled={busy || !branchName.trim() || !city.trim()}
        onPress={saveLocation} />

      <Text style={[s.title, { marginTop: 17 }]}>Historial de modificaciones</Text>
      {audit.length === 0 && <Text style={s.dim}>No hay modificaciones registradas.</Text>}
      {audit.map((a, i) => <Text key={i} style={s.dim}>
        {a.entity_type} · {a.action} · {new Date(a.changed_at).toLocaleString()}
      </Text>)}
    </View>}
  </View>;
}
