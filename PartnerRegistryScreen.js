// Registro permanente de candidatos a socios financieros (solo modo demostración).
// Las llamadas RPC comprueban el rol propietario en Supabase; ocultar esta pantalla no es una barrera de seguridad.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { validPartner, validLocation } from './partnerValidation';
import { writeThenRefresh } from './partnerWriteFlow';

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

function Field({ label, value, onChangeText, placeholder }) {
  return <View><Text style={s.text}>{label}</Text><TextInput
    accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText}
    autoCorrect={false} placeholder={placeholder} placeholderTextColor="#b3c5d9" /></View>;
}

export default function PartnerRegistryScreen({ supabase }) {
  const [partners, setPartners] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [locations, setLocations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('bank');
  const [country, setCountry] = useState('HN');
  const [branchName, setBranchName] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const writingRef = useRef(false);
  const partnersRequestRef = useRef(0);
  const detailsRequestRef = useRef(0);
  const [listReady, setListReady] = useState(false);
  const [detailsReady, setDetailsReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = partners.find(p => p.id === selectedId);
  async function request(name, params) {
    const { data, error: dbError } = await supabase.rpc(name, params);
    if (dbError) throw dbError;
    return data;
  }
  function report(err) {
    setError(err?.message || 'No se pudo completar la operación.');
    setNotice('');
  }
  async function reloadPartners(expectedSelectedId = selectedId) {
    // No permitir decisiones sobre un estado potencialmente desactualizado
    // mientras se consulta la lista, ni si la consulta termina fallando.
    const requestNumber = ++partnersRequestRef.current;
    setListReady(false);
    setDetailsReady(false);
    // No mostrar sucursales ni auditorías antiguas durante una recarga fallida.
    setLocations([]);
    setAudit([]);
    // Descarta también respuestas de detalles iniciadas antes de esta recarga.
    ++detailsRequestRef.current;
    const rows = await request('mwd_owner_partners_demo');
    if (requestNumber !== partnersRequestRef.current) throw Error('Consulta del listado reemplazada por una más reciente.');
    if (!Array.isArray(rows) || !rows.every(p => p && typeof p.id === 'string' && typeof p.legal_name === 'string' && typeof p.country_code === 'string' && typeof p.review_status === 'string')) {
      throw Error('Formato de respuesta del listado inválido; vuelve a consultar.');
    }
    setPartners(rows);
    setListReady(true);
    if (expectedSelectedId && !rows.some(p => p.id === expectedSelectedId)) {
      setSelectedId(null);
      setLocations([]);
      setAudit([]);
      setDetailsReady(false);
    }
    return rows;
  }
  async function reloadDetails(id) {
    const requestNumber = ++detailsRequestRef.current;
    if (!id) { setLocations([]); setAudit([]); setDetailsReady(false); return; }
    setLocations([]); setAudit([]); setDetailsReady(false);
    const [loc, hist] = await Promise.all([
      request('mwd_owner_partner_locations_demo', { p_partner_id: id }),
      request('mwd_owner_partner_audit_demo', { p_partner_id: id }),
    ]);
    if (requestNumber !== detailsRequestRef.current) throw Error('Consulta de detalles reemplazada por una más reciente.');
    // No publicar resultados parciales ni habilitar cambios si la RPC
    // devuelve un formato inesperado en lugar de un arreglo.
    if (!Array.isArray(loc) || !Array.isArray(hist) ||
        !loc.every(l => l && typeof l.id === 'string' && typeof l.display_name === 'string' && typeof l.city === 'string' && typeof l.currency_code === 'string') ||
        !hist.every(a => a && typeof a.entity_type === 'string' && typeof a.action === 'string' && typeof a.changed_at === 'string')) {
      throw Error('Formato de respuesta de detalles inválido; vuelve a consultar.');
    }
    setLocations(loc);
    setAudit(hist);
    setDetailsReady(true);
  }
  useEffect(() => {
    let active = true;
    const requestNumber = ++partnersRequestRef.current;
    supabase.rpc('mwd_owner_partners_demo').then(({ data, error: dbError }) => {
      if (!active || requestNumber !== partnersRequestRef.current) return;
      if (dbError) report(dbError);
      else if (!Array.isArray(data) || !data.every(p => p && typeof p.id === 'string' && typeof p.legal_name === 'string' && typeof p.country_code === 'string' && typeof p.review_status === 'string')) report(Error('Formato de respuesta del listado inválido; vuelve a consultar.'));
      else { setPartners(data); setListReady(true); }
    }).catch(err => { if (active && requestNumber === partnersRequestRef.current) report(err); });
    return () => { active = false; };
  }, [supabase]);

  async function savePartner() {
    if (busy || writingRef.current) return;
    if (!validPartner(name, country)) {
      setError('Escribe un nombre de 2 a 150 caracteres y un código de país de 2 letras.');
      return;
    }
    setError(''); setNotice(''); writingRef.current = true; setBusy(true);
    const outcome = await writeThenRefresh(
      () => request('mwd_owner_partner_save_demo', {
        p_legal_name: name.trim(),
        p_partner_kind: kind,
        p_country_code: country.trim().toUpperCase(),
      }),
      async result => {
        setName('');
        setSelectedId(result.id);
        setLocations([]); setAudit([]); setDetailsReady(false);
        const rows = await reloadPartners(result.id);
        if (!rows.some(p => p.id === result.id)) throw Error('El socio guardado no aparece en el listado actualizado.');
        await reloadDetails(result.id);
      },
    );
    if (outcome.state === 'confirmed') {
      setNotice('Candidato guardado como borrador; sin capacidad de pagar remesas.');
    } else if (outcome.state === 'confirmed-refresh-failed') {
      setName('');
      setNotice('Candidato guardado como borrador; sin capacidad de pagar remesas.');
      setError('El candidato se guardó, pero no se pudo actualizar la pantalla. Actualiza el listado; no vuelvas a guardarlo.');
    } else {
      setError('No se pudo confirmar el resultado del guardado. Verifica el listado antes de repetirlo. Detalle: ' + (outcome.error?.message || 'Error de conexión.'));
      setNotice('');
    }
    writingRef.current = false;
    setBusy(false);
  }
  async function choosePartner(id) {
    if (busy || !listReady || !partners.some(p => p.id === id)) return;
    setSelectedId(id); setLocations([]); setAudit([]); setDetailsReady(false); setError(''); setNotice(''); setBusy(true);
    try { await reloadDetails(id); }
    catch (err) { setLocations([]); setAudit([]); setDetailsReady(false); report(err); }
    finally { setBusy(false); }
  }
  async function setStatus(status) {
    if (!selectedId || busy || writingRef.current || !listReady || !detailsReady) return;
    // Defensa adicional: impedir transiciones que la interfaz no ofrece.
    if (!selected || !(NEXT[selected.review_status] || []).some(([next]) => next === status)) {
      setError('Transición de estado no permitida. Actualiza el listado y los detalles.');
      return;
    }
    setError(''); setNotice(''); writingRef.current = true; setBusy(true);
    const id = selectedId;
    const outcome = await writeThenRefresh(
      () => request('mwd_owner_partner_set_status_demo', {
        p_partner_id: id, p_new_status: status,
      }),
      async () => {
        setDetailsReady(false);
        const rows = await reloadPartners(id);
        if (!rows.some(p => p.id === id)) throw Error('El socio no aparece en el listado actualizado.');
        await reloadDetails(id);
      },
    );
    if (outcome.state === 'confirmed') {
      setNotice('Estado de revisión guardado. No habilita retiros ni pagos reales.');
    } else if (outcome.state === 'confirmed-refresh-failed') {
      setDetailsReady(false);
      setNotice('Estado de revisión guardado. No habilita retiros ni pagos reales.');
      setError('El estado se guardó, pero no se pudo actualizar la pantalla. Actualiza el listado y los detalles.');
    } else {
      setDetailsReady(false);
      setError('No se pudo confirmar el cambio de estado. Actualiza el listado y los detalles antes de otra transición. Detalle: ' + (outcome.error?.message || 'Error de conexión.'));
      setNotice('');
    }
    writingRef.current = false;
    setBusy(false);
  }
  async function saveLocation() {
    if (!selectedId || busy || writingRef.current || !listReady || !detailsReady || selected?.review_status === 'archived') return;
    if (!validLocation(branchName, city, currency, hours)) {
      setError('Revisa la sucursal (2-140 caracteres), ciudad (2-100), moneda (3 letras) y horario (máximo 140).');
      return;
    }
    setError(''); setNotice(''); writingRef.current = true; setBusy(true);
    const id = selectedId;
    const outcome = await writeThenRefresh(
      () => request('mwd_owner_partner_location_save_demo', {
        p_partner_id: id,
        p_display_name: branchName.trim(),
        p_city: city.trim(),
        p_currency_code: currency.trim().toUpperCase(),
        p_hours_note: hours.trim() || null,
      }),
      async () => {
        setBranchName(''); setCity(''); setHours('');
        await reloadDetails(id);
      },
    );
    if (outcome.state === 'confirmed') {
      setNotice('Sucursal candidata guardada. No es un punto de retiro autorizado.');
    } else if (outcome.state === 'confirmed-refresh-failed') {
      setBranchName(''); setCity(''); setHours('');
      setNotice('Sucursal candidata guardada. No es un punto de retiro autorizado.');
      setError('La sucursal se guardó, pero no se pudo actualizar el listado. Recarga los detalles; no vuelvas a guardarla.');
    } else {
      setError('No se pudo confirmar el guardado de la sucursal. Recarga los detalles y comprueba si aparece antes de repetirlo. Detalle: ' + (outcome.error?.message || 'Error de conexión.'));
      setNotice('');
    }
    writingRef.current = false;
    setBusy(false);
  }

  return <View>
    <Text style={s.warn}>REGISTRO INTERNO • SOLO PLANIFICACIÓN. Ningún banco o agente de esta sección está autorizado para pagar. No introduzcas contraseñas, documentos de identidad ni datos bancarios.</Text>
    {!!error && <Text style={[s.warn, { color: '#ff9494' }]}>{error}</Text>}
    {!!notice && <Text style={[s.text, { color: '#9cf0b3' }]}>{notice}</Text>}
    {busy && <ActivityIndicator color="#99c4ff" />}

    <View style={s.card}>
      <Text style={s.title}>Registrar futuro socio</Text>
      <Field label="Nombre de la entidad" value={name} onChangeText={setName} placeholder="Nombre legal de ejemplo o candidato" />
      <Field label="País (código de 2 letras)" value={country} onChangeText={setCountry} placeholder="NI, CR, HN..." />
      <Text style={s.text}>Tipo de entidad</Text>
      {KIND.map(([value, label]) => <Btn key={value}
        title={kind === value ? '✓ ' + label : label}
        secondary={kind !== value} disabled={busy} onPress={() => setKind(value)} />)}
      <Btn title="Guardar borrador permanente" disabled={busy || !validPartner(name, country)} onPress={savePartner} />
    </View>

    <View style={s.card}>
      <Text style={s.title}>Candidatos registrados ({listReady ? partners.length : "sin verificar"})</Text>
      {!listReady && <Text style={s.dim}>Listado no cargado. Presiona Actualizar listado para reintentar.</Text>}
      {listReady && partners.length === 0 && <Text style={s.dim}>Aún no existen registros permanentes.</Text>}
      {listReady && partners.map(p => <Btn key={p.id}
        title={(selectedId === p.id ? '✓ ' : '') + p.legal_name + ' · ' + p.country_code + '\n' + (LABELS[p.review_status] || p.review_status)}
        secondary={selectedId !== p.id} disabled={busy || !listReady} onPress={() => choosePartner(p.id)} />)}
      <Btn title="Actualizar listado" secondary disabled={busy} onPress={async () => {
        setBusy(true); setError('');
        try {
          const rows = await reloadPartners();
          // Una sola lectura del listado: evita consultas duplicadas.
          if (selectedId && rows.some(p => p.id === selectedId)) {
            await reloadDetails(selectedId);
          }
        } catch (err) { report(err); }
        finally { setBusy(false); }
      }} />
    </View>

    {listReady && selected && <View style={s.card}>
      <Text style={s.title}>{selected.legal_name}</Text>
      <Text style={s.dim}>Estado: {LABELS[selected.review_status] || selected.review_status}</Text>
      <Text style={s.warn}>“Documentación revisada” no equivale a licencia, contrato ni autorización operativa.</Text>
      {(NEXT[selected.review_status] || []).map(([status, label]) =>
        <Btn key={status} title={label} secondary disabled={busy || !listReady || !detailsReady} onPress={() => setStatus(status)} />)}

      {!detailsReady && <Text style={s.dim}>Los detalles no están disponibles. Puedes reintentar la consulta.</Text>}
      {!detailsReady && <Btn title="Reintentar carga de detalles" secondary disabled={busy || !listReady} onPress={async () => {
        setBusy(true); setError('');
        try { await reloadDetails(selectedId); } catch (err) { report(err); }
        finally { setBusy(false); }
      }} />}
      <Text style={[s.title, { marginTop: 17 }]}>Sucursales candidatas</Text>
      {locations.map(l => <Text key={l.id} style={s.text}>
        {l.display_name} — {l.city} — {l.currency_code} · Borrador
      </Text>)}
      {selected.review_status === 'archived' && <Text style={s.warn}>Socio archivado: no se pueden registrar nuevas sucursales.</Text>}
      <Field label="Nombre de sucursal" value={branchName} onChangeText={setBranchName} />
      <Field label="Ciudad" value={city} onChangeText={setCity} />
      <Field label="Moneda de referencia (3 letras)" value={currency} onChangeText={setCurrency} />
      <Field label="Horario orientativo (opcional)" value={hours} onChangeText={setHours} />
      <Btn title="Guardar sucursal candidata" disabled={busy || !listReady || !detailsReady || selected.review_status === 'archived' || !validLocation(branchName, city, currency, hours)}
        onPress={saveLocation} />

      <Text style={[s.title, { marginTop: 17 }]}>Historial de modificaciones</Text>
      {detailsReady && audit.length === 0 && <Text style={s.dim}>No hay modificaciones registradas.</Text>}
      {!detailsReady && <Text style={s.dim}>Historial no verificado: actualiza los detalles antes de sacar conclusiones.</Text>}
      {audit.map((a, i) => <Text key={i} style={s.dim}>
        {a.entity_type} · {a.action} · {new Date(a.changed_at).toLocaleString()}
      </Text>)}
    </View>}
  </View>;
}
