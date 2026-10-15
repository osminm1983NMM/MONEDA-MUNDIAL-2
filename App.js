// MONEDA MUNDIAL 2.0 — DEMOSTRACIÓN CON SUPABASE
// Los MWD son créditos ficticios. Esta aplicación NO mueve dinero real.
// Copia este archivo COMPLETO en App.js de un Snack NUEVO (conserva la versión 1.3).
// Dependencias de Snack: @supabase/supabase-js, @react-native-async-storage/async-storage,
// react-native-url-polyfill, react-native-get-random-values.

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React, { useEffect, useRef, useState, useContext, createContext } from 'react';
import {
  View, Text as RNText, TextInput as RNTextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, StatusBar, Share, Linking, AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { resolveAppLanguage, translate, LANGUAGE_SETTING_KEY, formatLocalizedDate } from './src/i18n.mjs';
import { createClient } from '@supabase/supabase-js';
import { amountToCents, formatMWD, normalizeRecipientCode, normalizePaymentRequestId } from './src/demo-money.mjs';
import { classifyDemoOperation, formatDemoReceipt } from './src/demo-receipts.mjs';
import { DEMO_CORRIDORS } from './src/international-demo.mjs';
import { canApplySessionResponse } from './src/session-guards.mjs';
import { isLatestRequest, isValidDemoQuoteResponse, isValidDemoPaymentPreview } from './src/async-demo-guards.mjs';
import { needsDemoFeeReview, demoFeeShortfallCents } from './src/quote-risk.mjs';
import { maskEmail } from './src/privacy.mjs';
import {searchDemoPayoutAgents} from './src/demo-payout-agents.mjs';
import {makeDemoPartnerDraft,makeDemoBranchDraft,summarizeDemoPayoutAdmin,deleteDemoPartnerDraft} from './src/payout-admin-drafts.mjs';
import { createCashPickupDemo, generateCashPickupSampleBytes, normalizeCashPickupCountries } from './src/cash-pickup-demo.mjs';

// CLAVE PUBLICABLE de Supabase. Nunca coloques claves secret/service_role en App.js.
const SUPABASE_URL = 'https://egrsdrlpavrtbgxoyxvg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sKotmweOAug6XqTR16U9Wg_ugxAx3vm';
const RECOVERY_REDIRECT_URL = 'monedamundial://auth/recovery';

// Nombres ISO para el catálogo de alcance mundial; la interfaz nunca cambia
// la autorización financiera, que se decide exclusivamente en el servidor.
const COUNTRY_NAMES_EN = Object.freeze({
  "AD": "Andorra",
  "AE": "United Arab Emirates",
  "AF": "Afghanistan",
  "AG": "Antigua & Barbuda",
  "AI": "Anguilla",
  "AL": "Albania",
  "AM": "Armenia",
  "AO": "Angola",
  "AQ": "Antarctica",
  "AR": "Argentina",
  "AS": "American Samoa",
  "AT": "Austria",
  "AU": "Australia",
  "AW": "Aruba",
  "AX": "Åland Islands",
  "AZ": "Azerbaijan",
  "BA": "Bosnia & Herzegovina",
  "BB": "Barbados",
  "BD": "Bangladesh",
  "BE": "Belgium",
  "BF": "Burkina Faso",
  "BG": "Bulgaria",
  "BH": "Bahrain",
  "BI": "Burundi",
  "BJ": "Benin",
  "BL": "St. Barthélemy",
  "BM": "Bermuda",
  "BN": "Brunei",
  "BO": "Bolivia",
  "BQ": "Caribbean Netherlands",
  "BR": "Brazil",
  "BS": "Bahamas",
  "BT": "Bhutan",
  "BV": "Bouvet Island",
  "BW": "Botswana",
  "BY": "Belarus",
  "BZ": "Belize",
  "CA": "Canada",
  "CC": "Cocos (Keeling) Islands",
  "CD": "Congo - Kinshasa",
  "CF": "Central African Republic",
  "CG": "Congo - Brazzaville",
  "CH": "Switzerland",
  "CI": "Côte d’Ivoire",
  "CK": "Cook Islands",
  "CL": "Chile",
  "CM": "Cameroon",
  "CN": "China",
  "CO": "Colombia",
  "CR": "Costa Rica",
  "CU": "Cuba",
  "CV": "Cape Verde",
  "CW": "Curaçao",
  "CX": "Christmas Island",
  "CY": "Cyprus",
  "CZ": "Czechia",
  "DE": "Germany",
  "DJ": "Djibouti",
  "DK": "Denmark",
  "DM": "Dominica",
  "DO": "Dominican Republic",
  "DZ": "Algeria",
  "EC": "Ecuador",
  "EE": "Estonia",
  "EG": "Egypt",
  "EH": "Western Sahara",
  "ER": "Eritrea",
  "ES": "Spain",
  "ET": "Ethiopia",
  "FI": "Finland",
  "FJ": "Fiji",
  "FK": "Falkland Islands (Islas Malvinas)",
  "FM": "Micronesia",
  "FO": "Faroe Islands",
  "FR": "France",
  "GA": "Gabon",
  "GB": "United Kingdom",
  "GD": "Grenada",
  "GE": "Georgia",
  "GF": "French Guiana",
  "GG": "Guernsey",
  "GH": "Ghana",
  "GI": "Gibraltar",
  "GL": "Greenland",
  "GM": "Gambia",
  "GN": "Guinea",
  "GP": "Guadeloupe",
  "GQ": "Equatorial Guinea",
  "GR": "Greece",
  "GS": "South Georgia & South Sandwich Islands",
  "GT": "Guatemala",
  "GU": "Guam",
  "GW": "Guinea-Bissau",
  "GY": "Guyana",
  "HK": "Hong Kong",
  "HM": "Heard & McDonald Islands",
  "HN": "Honduras",
  "HR": "Croatia",
  "HT": "Haiti",
  "HU": "Hungary",
  "ID": "Indonesia",
  "IE": "Ireland",
  "IL": "Israel",
  "IM": "Isle of Man",
  "IN": "India",
  "IO": "British Indian Ocean Territory",
  "IQ": "Iraq",
  "IR": "Iran",
  "IS": "Iceland",
  "IT": "Italy",
  "JE": "Jersey",
  "JM": "Jamaica",
  "JO": "Jordan",
  "JP": "Japan",
  "KE": "Kenya",
  "KG": "Kyrgyzstan",
  "KH": "Cambodia",
  "KI": "Kiribati",
  "KM": "Comoros",
  "KN": "St. Kitts & Nevis",
  "KP": "North Korea",
  "KR": "South Korea",
  "KW": "Kuwait",
  "KY": "Cayman Islands",
  "KZ": "Kazakhstan",
  "LA": "Laos",
  "LB": "Lebanon",
  "LC": "St. Lucia",
  "LI": "Liechtenstein",
  "LK": "Sri Lanka",
  "LR": "Liberia",
  "LS": "Lesotho",
  "LT": "Lithuania",
  "LU": "Luxembourg",
  "LV": "Latvia",
  "LY": "Libya",
  "MA": "Morocco",
  "MC": "Monaco",
  "MD": "Moldova",
  "ME": "Montenegro",
  "MF": "St. Martin",
  "MG": "Madagascar",
  "MH": "Marshall Islands",
  "MK": "North Macedonia",
  "ML": "Mali",
  "MM": "Myanmar (Burma)",
  "MN": "Mongolia",
  "MO": "Macao",
  "MP": "Northern Mariana Islands",
  "MQ": "Martinique",
  "MR": "Mauritania",
  "MS": "Montserrat",
  "MT": "Malta",
  "MU": "Mauritius",
  "MV": "Maldives",
  "MW": "Malawi",
  "MX": "Mexico",
  "MY": "Malaysia",
  "MZ": "Mozambique",
  "NA": "Namibia",
  "NC": "New Caledonia",
  "NE": "Niger",
  "NF": "Norfolk Island",
  "NG": "Nigeria",
  "NI": "Nicaragua",
  "NL": "Netherlands",
  "NO": "Norway",
  "NP": "Nepal",
  "NR": "Nauru",
  "NU": "Niue",
  "NZ": "New Zealand",
  "OM": "Oman",
  "PA": "Panama",
  "PE": "Peru",
  "PF": "French Polynesia",
  "PG": "Papua New Guinea",
  "PH": "Philippines",
  "PK": "Pakistan",
  "PL": "Poland",
  "PM": "St. Pierre & Miquelon",
  "PN": "Pitcairn Islands",
  "PR": "Puerto Rico",
  "PS": "Palestine",
  "PT": "Portugal",
  "PW": "Palau",
  "PY": "Paraguay",
  "QA": "Qatar",
  "RE": "Réunion",
  "RO": "Romania",
  "RS": "Serbia",
  "RU": "Russia",
  "RW": "Rwanda",
  "SA": "Saudi Arabia",
  "SB": "Solomon Islands",
  "SC": "Seychelles",
  "SD": "Sudan",
  "SE": "Sweden",
  "SG": "Singapore",
  "SH": "St. Helena",
  "SI": "Slovenia",
  "SJ": "Svalbard & Jan Mayen",
  "SK": "Slovakia",
  "SL": "Sierra Leone",
  "SM": "San Marino",
  "SN": "Senegal",
  "SO": "Somalia",
  "SR": "Suriname",
  "SS": "South Sudan",
  "ST": "São Tomé & Príncipe",
  "SV": "El Salvador",
  "SX": "Sint Maarten",
  "SY": "Syria",
  "SZ": "Eswatini",
  "TC": "Turks & Caicos Islands",
  "TD": "Chad",
  "TF": "French Southern Territories",
  "TG": "Togo",
  "TH": "Thailand",
  "TJ": "Tajikistan",
  "TK": "Tokelau",
  "TL": "Timor-Leste",
  "TM": "Turkmenistan",
  "TN": "Tunisia",
  "TO": "Tonga",
  "TR": "Türkiye",
  "TT": "Trinidad & Tobago",
  "TV": "Tuvalu",
  "TW": "Taiwan",
  "TZ": "Tanzania",
  "UA": "Ukraine",
  "UG": "Uganda",
  "UM": "U.S. Outlying Islands",
  "US": "United States",
  "UY": "Uruguay",
  "UZ": "Uzbekistan",
  "VA": "Vatican City",
  "VC": "St. Vincent & Grenadines",
  "VE": "Venezuela",
  "VG": "British Virgin Islands",
  "VI": "U.S. Virgin Islands",
  "VN": "Vietnam",
  "VU": "Vanuatu",
  "WF": "Wallis & Futuna",
  "WS": "Samoa",
  "YE": "Yemen",
  "YT": "Mayotte",
  "ZA": "South Africa",
  "ZM": "Zambia",
  "ZW": "Zimbabwe"
});
function demoPaymentStatus(status, language = 'es') {
  const labels = { pending: 'Pendiente de pago', paid: 'Pagado', cancelled: 'Cancelado', canceled: 'Cancelado' };
  return translate(labels[status] || 'Estado desconocido', language);
}
function countryName(code, nameEs, language) {
  return language === 'en' ? (COUNTRY_NAMES_EN[code] || nameEs) : nameEs;
}
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Un solo motor de traducción para los textos y campos de todas las pantallas.
const LanguageContext = createContext('es');
function trChild(child, language) {
  if (typeof child !== 'string') return child;
  const stripped = child.trim();
  if (!stripped) return child;
  const translated = translate(stripped, language);
  if (translated === stripped) return child;
  return child.replace(stripped, translated);
}
function Text({children, ...props}) {
  const language = useContext(LanguageContext);
  return <RNText {...props}>{React.Children.map(children, c => trChild(c, language))}</RNText>;
}
function TextInput(props) {
  const language = useContext(LanguageContext);
  return <RNTextInput {...props} placeholder={translate(props.placeholder,language)} />;
}
function deviceLanguage() {
  try { return getLocales()?.[0]?.languageTag || 'es'; }
  catch { return 'es'; }
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

function confirmAction(title, detail, action, language = 'es') {
  if (Platform.OS === 'web') {
    if (window.confirm(title + '\n' + detail)) action();
  } else {
    Alert.alert(title, detail, [
      { text: translate('Cancelar', language), style: 'cancel' },
      { text: translate('Confirmar', language), onPress: action },
    ]);
  }
}

async function shareDemoCode(kind, value) {
  if (!value) return;
  const label = kind === 'wallet'
    ? 'Mi identificador de billetera de demostración:'
    : 'Solicitud de cobro ficticio de Moneda Mundial:';
  try {
    await Share.share({ message: label + '\n' + value + '\nSOLO PRUEBAS - SIN DINERO REAL' });
  } catch (error) {
    message('Compartir', error.message || 'No fue posible compartir el código.');
  }
}

function Btn({ title, onPress, secondary = false, disabled = false }) {
  const language = useContext(LanguageContext);
  const prefix = typeof title === 'string' && title.startsWith('✓ ') ? '✓ ' : '';
  const translatedTitle = prefix + translate(prefix ? title.slice(2) : title, language);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{translatedTitle}</Text>
    </TouchableOpacity>
  );
}

// Selector compacto: evita recorrer 19 botones grandes para llegar a la cotización.
function CountrySelector({ title, options, selectedCode, onChoose }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const normal = value => String(value || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const current = options.find(item => item.code === selectedCode);
  const visible = options.filter(item => normal(item.label).includes(normal(search)));
  return (
    <View style={styles.countryPicker}>
      <Text style={styles.muted}>{title}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cambiar país"
        style={styles.countryToggle} onPress={() => setExpanded(value => !value)}>
        <Text style={styles.countryToggleText}>
          {current ? current.label + (current.info ? ' · ' + current.info : '') : 'Selecciona un país'}
          {expanded ? '  ▲' : '  ▼'}
        </Text>
      </TouchableOpacity>
      {expanded && <View style={styles.countryOptions}>
        <TextInput style={styles.input} placeholder="Buscar país" value={search}
          autoCorrect={false} placeholderTextColor="#9fb1c8" onChangeText={setSearch} />
        {visible.map(item => (
          <TouchableOpacity key={item.code} accessibilityRole="button"
            accessibilityLabel={item.label} style={[
              styles.countryOption, item.code === selectedCode && styles.countryOptionSelected
            ]} onPress={() => {
              onChoose(item.code);
              setExpanded(false);
              setSearch('');
            }}>
            <Text style={styles.countryOptionText}>
              {item.code === selectedCode ? '✓ ' : ''}{item.label}
              {item.info ? ' · ' + item.info : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {visible.length === 0 && <Text style={styles.muted}>No se encontró ese país.</Text>}
      </View>}
    </View>
  );
}

export default function App() {
  const [deviceLocale, setDeviceLocale] = useState(deviceLanguage);
  const [languageMode, setLanguageMode] = useState('auto');
  const language = resolveAppLanguage(languageMode, deviceLocale);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_SETTING_KEY)
      .then(value => {
        if (active && ['auto','es','en'].includes(value)) setLanguageMode(value);
      })
      .catch(() => {});
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && active) setDeviceLocale(deviceLanguage());
    });
    return () => { active = false; sub.remove(); };
  }, []);
  function showMessage(title, body) {
    return message(translate(title,language),translate(body,language));
  }
  function showConfirm(title, detail, action) {
    return confirmAction(translate(title,language),translate(detail,language),action,language);
  }
  async function chooseLanguage(mode) {
    if (!['auto','es','en'].includes(mode)) return;
    setLanguageMode(mode);
    try { await AsyncStorage.setItem(LANGUAGE_SETTING_KEY,mode); }
    catch { showMessage('Idioma', 'No se pudo guardar la preferencia.'); }
  }
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [screen, setScreen] = useState('Inicio');
  const [wallet, setWallet] = useState(null);
  const [operations, setOperations] = useState([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [demoDestination, setDemoDestination] = useState('EC');
  const [worldCountries, setWorldCountries] = useState(null);
  const [worldQuery, setWorldQuery] = useState('');
  const [worldLoading, setWorldLoading] = useState(false);
  const [demoMethod, setDemoMethod] = useState('bank');
  const [demoAmount, setDemoAmount] = useState('100');
  const [pickupAmount, setPickupAmount] = useState('100');
  const [pickupDestination, setPickupDestination] = useState('NI');
  const [agentSearch,setAgentSearch]=useState('');
  const [pickupSample, setPickupSample] = useState(null);
  const [internationalQuote, setInternationalQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [draftPartners,setDraftPartners]=useState([]);
  const [draftBranches,setDraftBranches]=useState([]);
  const [draftPartnerName,setDraftPartnerName]=useState('');
  const [draftPartnerCountry,setDraftPartnerCountry]=useState('NI');
  const [draftPartnerType,setDraftPartnerType]=useState('bank');
  const [draftBranchCity,setDraftBranchCity]=useState('');
  const [draftBranchCurrency,setDraftBranchCurrency]=useState('NIO');
  const [draftBranchHours,setDraftBranchHours]=useState('L-V 09:00-17:00');
  const [draftSelectedPartner,setDraftSelectedPartner]=useState('');
  const [ownerSummary, setOwnerSummary] = useState(null);
  const [feeCatalog, setFeeCatalog] = useState(null);
  const [feeCountry, setFeeCountry] = useState('EC');
  const [feePercent, setFeePercent] = useState('1.00');
  const [feeMinimum, setFeeMinimum] = useState('0.50');
  const [feeSaving, setFeeSaving] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [merchant, setMerchant] = useState(null);
  const [merchantName, setMerchantName] = useState('');
  const [merchantCountry, setMerchantCountry] = useState('US');
  const [merchantAmount, setMerchantAmount] = useState('');
  const [merchantDescription, setMerchantDescription] = useState('');
  const [merchantRequests, setMerchantRequests] = useState([]);
  const [merchantBusy, setMerchantBusy] = useState(false);
  const [paymentCode, setPaymentCode] = useState('');
  const [paymentPreview, setPaymentPreview] = useState(null);
  const busyRef = useRef(false);
  const pendingRef = useRef(null);
  const quoteSequenceRef = useRef(0);
  const paymentLookupSequenceRef = useRef(0);
  const recoveryInProgressRef = useRef(false);
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) setSession(data.session);
      })
      .catch(error => showMessage('Sesión', error.message))
      .finally(() => { if (active) setAuthLoading(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthLoading(false);
      if (event === 'SIGNED_OUT') {
        recoveryInProgressRef.current = false;
        setScreen('Inicio');
      } else if (event === 'PASSWORD_RECOVERY' ||
                 (recoveryInProgressRef.current && nextSession)) {
        setScreen('NuevaContrasena');
      } else if (event === 'SIGNED_IN') {
        setScreen('Inicio');
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Capturar enlaces de restablecimiento dirigidos exclusivamente a esta app.
  useEffect(() => {
    let active = true;
    async function onRecoveryUrl(url) {
      if (!active || typeof url !== 'string' ||
          !url.startsWith(RECOVERY_REDIRECT_URL)) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'monedamundial:' || parsed.hostname !== 'auth' ||
            parsed.pathname !== '/recovery') return;
        const params = new URLSearchParams(parsed.hash.slice(1));
        if (params.has('error') || params.has('error_code')) {
          throw new Error('Enlace caducado o inválido. Solicita otro.');
        }
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (params.get('type') !== 'recovery' || !access_token || !refresh_token) {
          throw new Error('Enlace incompleto.');
        }
        recoveryInProgressRef.current = true;
        const { data, error } = await supabase.auth.setSession({
          access_token, refresh_token,
        });
        if (error) throw error;
        if (!data?.session) throw new Error('No se pudo confirmar la sesión.');
        if (active) setScreen('NuevaContrasena');
      } catch (error) {
        recoveryInProgressRef.current = false;
        if (active) showMessage('Recuperación', error.message || 'Solicita otro enlace.');
      }
    }
    Linking.getInitialURL().then(onRecoveryUrl).catch(() => {});
    const linkSubscription = Linking.addEventListener('url', ({ url }) => onRecoveryUrl(url));
    return () => { active = false; linkSubscription.remove(); };
  }, []);

  useEffect(() => {
    // No mantener información de la cuenta anterior mientras carga una nueva sesión.
    // También se descartan formularios e identificadores de operación pendientes.
    setWallet(null);
    setOperations([]);
    setSelectedReceiptId(null);
    setAdminRole(null);
    setDraftPartners([]);
    setDraftBranches([]);
    setDraftPartnerName('');
    setDraftBranchCity('');
    setDraftSelectedPartner('');
    setOwnerSummary(null);
    setFeeCatalog(null);
    setMerchant(null);
    setMerchantRequests([]);
    setMerchantName('');
    setMerchantCountry('US');
    setMerchantAmount('');
    setMerchantDescription('');
    paymentLookupSequenceRef.current += 1;
    quoteSequenceRef.current += 1;
    setPaymentPreview(null);
    setPaymentCode('');
    setInternationalQuote(null);
    pendingRef.current = null;
    if (!userId) return;
    refreshAccount(userId);
    refreshMerchant(userId);
  }, [userId]);

  async function refreshDemoFeeCatalog() {
    if (adminRole !== 'owner' || !userId) return;
    const requestedUserId = userId;
    try {
      const {data,error} = await supabase.rpc('mwd_owner_demo_fee_catalog');
      if (error) throw error;
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(requestedUserId, activeSession)) return;
      const catalog = Array.isArray(data) ? data : [];
      setFeeCatalog(catalog);
      const selected = catalog.find(item => item.destination === feeCountry);
      if (selected) {
        setFeePercent((selected.feeBps / 100).toFixed(2));
        setFeeMinimum(formatMWD(selected.minFeeCents));
      }
    } catch (error) {
      showMessage('Tarifas de prueba', 'No se pudo cargar el catálogo del propietario.');
    }
  }

  async function saveOwnerDemoFee() {
    if (adminRole !== 'owner' || feeSaving) return;
    const pct = String(feePercent).trim().replace(',', '.');
    const minText = String(feeMinimum).trim().replace(',', '.');
    const min = minText === '0' || minText === '0.00' ? 0 : amountToCents(minText);
    const [wholePct, fractionalPct = ''] = pct.split('.');
    const bps = Number(wholePct) * 100 + Number(fractionalPct.padEnd(2, '0'));
    if (!/^[0-9]{1,2}([.][0-9]{1,2})?$/.test(pct) ||
        !Number.isSafeInteger(bps) || bps < 10 || bps > 1000 ||
        min === null || min < 0 || min > 5000) {
      return showMessage('Tarifa inválida', 'Comisión entre 0.10% y 10.00%; mínimo entre 0 y 50 USD.');
    }
    const country = feeCatalog?.find(r => r.destination === feeCountry);
    if (!country) return showMessage('País', 'Selecciona un país del catálogo.');
    showConfirm('Modificar solo tarifa ficticia',
      'Guardar tarifa de prueba de ' + pct + '% y mínimo ' + minText +
      ' USD para ' + country.country + '? NO habilita dinero real.',
      async () => {
        setFeeSaving(true);
        try {
          const {data,error} = await supabase.rpc('mwd_owner_update_demo_fee', {
            p_destination_country: feeCountry, p_fee_bps: bps, p_min_fee_cents: min
          });
          if (error) throw error;
          if (!['updated_simulation','unchanged_simulation'].includes(data?.status))
            throw Error('Confirmación inválida');
          setInternationalQuote(null);
          await refreshDemoFeeCatalog();
          showMessage('Guardado', 'Tarifa ficticia confirmada. No procesa dinero real.');
        } catch (error) {
          showMessage('No se pudo guardar', 'Comprueba tu sesión y los valores.');
        } finally {
          setFeeSaving(false);
        }
      });
  }

  async function loadWorldCountries() {
    if (worldLoading || !userId) return;
    const requestedUserId = userId;
    setWorldLoading(true);
    try {
      const { data, error } = await supabase.rpc('mwd_world_countries_demo');
      if (error) throw error;
      if (!Array.isArray(data)) throw Error('Catálogo no disponible');
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(requestedUserId, activeSession)) return;
      setWorldCountries(data);
    } catch (error) {
      showMessage('Países del mundo', 'No se pudo consultar el catálogo mundial. Inténtalo nuevamente.');
    } finally {
      setWorldLoading(false);
    }
  }

  async function fetchDemoInternationalQuote() {
    if (!userId || quoteBusy) return;
    const requestedUserId = userId;
    const quoteSequence = ++quoteSequenceRef.current;
    const requestedQuote = { destination: demoDestination, method: demoMethod, amountCents: amountToCents(demoAmount) };
    const cents = requestedQuote.amountCents;
    if (cents === null || cents < 100 || cents > 10000000) {
      return showMessage('Cantidad', 'Introduce un importe entre 1 y 100,000 USD para esta simulación.');
    }
    setInternationalQuote(null);
    setQuoteBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_quote_international_demo', {
        p_destination_country: demoDestination,
        p_amount_cents: cents,
        p_method: demoMethod,
      });
      if (error) throw error;
      if (!isValidDemoQuoteResponse(data, requestedQuote)) {
        throw new Error('El servidor no devolvió una simulación válida.');
      }
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(requestedUserId, activeSession) ||
          !isLatestRequest(quoteSequence, quoteSequenceRef.current)) return;
      setInternationalQuote(data);
    } catch (error) {
      showMessage('Simulación', 'No fue posible calcular la cotización de prueba. Inténtalo otra vez.');
    } finally {
      setQuoteBusy(false);
    }
  }

  async function refreshOwnerSummary() {
    if (adminRole !== 'owner' || ownerLoading || !userId) return;
    const requestedUserId = userId;
    setOwnerLoading(true);
    try {
      const { data, error } = await supabase.rpc('mwd_owner_summary_demo');
      if (error) throw error;
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(requestedUserId, activeSession)) return;
      setOwnerSummary(data);
    } catch (error) {
      showMessage('Panel propietario', 'No fue posible cargar el resumen de demostración.');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function refreshAccount(id = userId) {
    if (!id) return;
    setSyncing(true);
    try {
      const [w, h, a] = await Promise.all([
        supabase.from('mwd_wallets')
          .select('user_id,account_code,balance_cents')
          .eq('user_id', id).single(),
        supabase.rpc('mwd_history_demo'),
        supabase.from('mwd_admin_roles').select('role').eq('user_id', id).maybeSingle(),
      ]);
      if (w.error) throw w.error;
      if (h.error) throw h.error;
      if (a.error) throw a.error;
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(id, activeSession)) return;
      setWallet(w.data);
      setOperations(h.data || []);
      setAdminRole(a.data?.role || null);
    } catch (error) {
      showMessage('Sincronización', error.message || 'No se pudo consultar Supabase.');
    } finally {
      setSyncing(false);
    }
  }

  async function refreshMerchant(id = userId) {
    if (!id) return;
    try {
      const [m, r] = await Promise.all([
        supabase.from('mwd_merchants')
          .select('owner_user_id,business_name,country_code')
          .eq('owner_user_id', id).maybeSingle(),
        supabase.from('mwd_payment_requests')
          .select('id,amount_cents,currency_code,status,description,created_at')
          .eq('merchant_user_id', id)
          .order('created_at', { ascending: false }).limit(20),
      ]);
      if (m.error) throw m.error;
      if (r.error) throw r.error;
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(id, activeSession)) return;
      setMerchant(m.data);
      setMerchantRequests(r.data || []);
      if (m.data) {
        setMerchantName(m.data.business_name);
        setMerchantCountry(m.data.country_code);
      }
    } catch (error) {
      showMessage('Comercios', error.message || 'No se pudo consultar el comercio.');
    }
  }

  async function saveMerchant() {
    const business_name = merchantName.trim();
    const country_code = merchantCountry.trim().toUpperCase();
    if (business_name.length < 2 || business_name.length > 120) {
      return showMessage('Comercio', 'El nombre debe tener entre 2 y 120 caracteres.');
    }
    if (!/^[A-Z]{2}$/.test(country_code)) {
      return showMessage('País', 'Introduce un código ISO de dos letras, por ejemplo US o HN.');
    }
    if (!userId || merchantBusy) return;
    setMerchantBusy(true);
    try {
      const { error } = await supabase.from('mwd_merchants').upsert({
        owner_user_id: userId, business_name, country_code,
      }, { onConflict: 'owner_user_id' });
      if (error) throw error;
      await refreshMerchant(userId);
      showMessage('Comercio de prueba', 'Datos del comercio guardados en Supabase.');
    } catch (error) {
      showMessage('Comercio', error.message || 'No se pudo guardar el comercio.');
    } finally {
      setMerchantBusy(false);
    }
  }

  async function createMerchantRequest() {
    const cents = amountToCents(merchantAmount);
    if (cents === null) {
      return showMessage('Cantidad', 'Importe inválido. Máximo 1,000,000 MWD ficticios.');
    }
    const description = merchantDescription.trim();
    if (description.length > 240) {
      return showMessage('Descripción', 'Máximo 240 caracteres.');
    }
    if (!merchant || !userId || merchantBusy) {
      return showMessage('Comercio', 'Primero registra tu comercio de prueba.');
    }
    setMerchantBusy(true);
    try {
      const { error } = await supabase.from('mwd_payment_requests').insert({
        merchant_user_id: userId, amount_cents: cents,
        currency_code: 'MWD', status: 'pending', description: description || null,
      });
      if (error) throw error;
      setMerchantAmount('');
      setMerchantDescription('');
      await refreshMerchant(userId);
      showMessage('Cobro de demostración', 'Solicitud creada. Comparte su identificador UUID con el cliente de prueba.');
    } catch (error) {
      showMessage('Cobro', error.message || 'No se pudo crear la solicitud.');
    } finally {
      setMerchantBusy(false);
    }
  }

  function cancelMerchantRequest(id) {
    if (merchantBusy) return;
    showConfirm('Cancelar cobro ficticio', 'Esta solicitud ya no podrá pagarse.', async () => {
      setMerchantBusy(true);
      try {
        const { data, error } = await supabase.rpc('mwd_cancel_payment_request_demo', {
          p_payment_id: id,
        });
        if (error) throw error;
        if (data?.status !== 'cancelled' && data?.status !== 'expired') {
          throw new Error('No se confirmó la cancelación.');
        }
        await refreshMerchant();
      } catch (error) {
        showMessage('Cancelación', error.message || 'No se pudo cancelar el cobro.');
      } finally {
        setMerchantBusy(false);
      }
    });
  }

  async function lookupMerchantPayment() {
    if (!userId) return;
    const requestedUserId = userId;
    const lookupSequence = ++paymentLookupSequenceRef.current;
    const id = normalizePaymentRequestId(paymentCode);
    if (!id) {
      return showMessage('Código', 'Introduce el identificador UUID de la solicitud.');
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPaymentPreview(null);
    try {
      const { data, error } = await supabase.rpc('mwd_get_payment_request_demo', {
        p_payment_id: id,
      });
      if (error) throw error;
      if (!isValidDemoPaymentPreview(data, id)) {
        throw new Error('Solicitud de demostración no disponible.');
      }
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (!canApplySessionResponse(requestedUserId, activeSession) ||
          !isLatestRequest(lookupSequence, paymentLookupSequenceRef.current)) return;
      setPaymentPreview(data);
    } catch (error) {
      showMessage('Consultar cobro', error.message || 'No se encontró el cobro.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirmMerchantPayment() {
    if (!paymentPreview || paymentPreview.status !== 'pending' || busyRef.current) return;
    if (!wallet || paymentPreview.amount_cents > wallet.balance_cents) {
      return showMessage('Saldo insuficiente', 'No tienes MWD ficticios suficientes.');
    }
    const id = paymentPreview.id;
    showConfirm('Pagar comercio de prueba',
      'Comercio: ' + paymentPreview.business_name +
      '\nCantidad: ' + formatMWD(paymentPreview.amount_cents) +
      ' MWD ficticios\nNo se mueve dinero real.',
      () => payMerchant(id));
  }

  async function payMerchant(id) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('mwd_pay_merchant_demo', {
        p_payment_id: id,
      });
      if (error) throw error;
      if (!['ok', 'already_processed'].includes(data?.status)) {
        throw new Error('No se pudo confirmar el pago ficticio.');
      }
      setPaymentPreview(null);
      setPaymentCode('');
      await refreshAccount();
      await refreshMerchant();
      showMessage('Pago de demostración', 'Pago ficticio registrado en Supabase.');
    } catch (error) {
      showMessage('Pago no confirmado',
        (error.message || 'Error desconocido') +
        '\nConsulta de nuevo el estado antes de reintentar.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }


  // Enlace nativo de recuperación; no requiere plantilla SMTP personalizada.
  async function requestPasswordReset() {
    const requestedEmail = recoveryEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(requestedEmail)) {
      return showMessage('Correo', 'Introduce un correo electrónico válido.');
    }
    if (recoveryBusy) return;
    setRecoveryBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(requestedEmail, {
        redirectTo: RECOVERY_REDIRECT_URL,
      });
      if (error) throw error;
      setRecoveryEmail(requestedEmail);
      setScreen('VerificarCodigo');
      showMessage('Revisa tu correo', 'Si la cuenta existe, recibirás un enlace seguro. Ábrelo en este teléfono para volver a Moneda Mundial.');
    } catch (error) {
      showMessage('Recuperación', error.message || 'No se pudo enviar el correo.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function saveNewPassword() {
    if (newPassword.length < 12) {
      return showMessage('Contraseña', 'Utiliza al menos 12 caracteres para tu nueva contraseña.');
    }
    if (newPassword !== confirmNewPassword) {
      return showMessage('Contraseña', 'Las dos contraseñas no coinciden.');
    }
    if (recoveryBusy || !session) return;
    setRecoveryBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmNewPassword('');
      recoveryInProgressRef.current = false;
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) throw signOutError;
      setEmail(recoveryEmail);
      setScreen('Inicio');
      showMessage('Contraseña actualizada', 'Vuelve a iniciar sesión con tu nueva contraseña.');
    } catch (error) {
      showMessage('Cambio no confirmado', 'No pudimos completar todo el proceso. Revisa la sesión antes de volver a intentarlo.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function authenticate(action) {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return showMessage('Correo', 'Introduce un correo válido.');
    if (password.length < 8) return showMessage('Contraseña', 'Debe tener por lo menos 8 caracteres.');
    if (authBusy) return;
    setAuthBusy(true);
    try {
      if (action === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;
        showMessage('Registro de prueba', data.session
          ? 'Cuenta creada. Iniciaste sesión correctamente.'
          : 'Revisa tu correo para confirmar el registro. Luego regresa e inicia sesión.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
      }
      setPassword('');
    } catch (error) {
      showMessage('Acceso', error.message || 'No se pudo completar la operación.');
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
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const pending = pendingRef.current;
      if (!pending || pending.type !== type || pending.cents !== cents || pending.code !== code) {
        pendingRef.current = { type, cents, code, id: uniqueRequestId() };
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
      pendingRef.current = null;
      setAmount('');
      setRecipientCode('');
      setScreen('Inicio');
      await refreshAccount();
      showMessage('Operación ficticia confirmada', type === 'transfer'
        ? 'Transferencia de demostración registrada en Supabase.'
        : 'Aportación de demostración registrada en Supabase.');
    } catch (error) {
      showMessage('Operación no confirmada',
        (error.message || 'Error desconocido') + '\nPuedes reintentar sin cambiar los datos.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function prepareOperation(type) {
    if (busyRef.current) return;
    const cents = amountToCents(amount);
    if (cents === null) {
      return showMessage('Cantidad inválida', 'Introduce un importe positivo, máximo 1,000,000 MWD y dos decimales.');
    }
    if (!wallet) return showMessage('Espera', 'Primero carga tu cuenta.');
    if (cents > wallet.balance_cents) return showMessage('Saldo insuficiente', 'No tienes suficientes MWD ficticios.');
    const code = type === 'transfer' ? normalizeRecipientCode(recipientCode) : '';
    if (type === 'transfer') {
      if (!code) {
        return showMessage('Identificador', 'Introduce el código MWD- seguido de 16 caracteres.');
      }
      if (code === wallet.account_code) return showMessage('Destinatario', 'No puedes enviarte MWD a tu propia cuenta.');
    }
    showConfirm(type === 'transfer' ? 'Transferencia de prueba' : 'Aportación de prueba',
      `${formatMWD(cents)} MWD ficticios${type === 'transfer' ? '\nDestino: ' + code : '\nFondo de demostración'}`,
      () => executeOperation(type, cents, code));
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) showMessage('Salida', error.message);
  }

  function prepareCashPickupSample() {
    if (!worldCountries || !normalizeCashPickupCountries(worldCountries).some(c => c.code === pickupDestination)) {
      return showMessage('Países del mundo', 'Primero carga el catálogo mundial y selecciona un país.');
    }
    const cents = amountToCents(pickupAmount);
    setPickupSample(null);
    if (cents === null || cents < 100 || cents > 10000000) {
      return showMessage('Cantidad', 'Introduce un importe entre 1 y 100,000 USD para esta simulación.');
    }
    try {
      const bytes = generateCashPickupSampleBytes(globalThis.crypto);
      setPickupSample(createCashPickupDemo({ destination: pickupDestination, amountCents: cents, worldCatalog: worldCountries }, bytes));
    } catch (error) {
      showMessage('Simulación', 'No fue posible generar el código ficticio de muestra.');
    }
  }

  function createPartnerDraft() {
    if (adminRole!=='owner') return;
    const draft=makeDemoPartnerDraft({name:draftPartnerName,countryCode:draftPartnerCountry,type:draftPartnerType},uniqueRequestId());
    if(!draft)return showMessage('Registro de prueba','Comprueba el nombre, país y tipo de entidad ficticia.');
    setDraftPartners(p=>[...p,draft]);
    setDraftSelectedPartner(draft.id);
    setDraftPartnerName('');
  }

  function createBranchDraft() {
    if (adminRole!=='owner') return;
    const draft=makeDemoBranchDraft({partnerId:draftSelectedPartner,city:draftBranchCity,currencyCode:draftBranchCurrency,hours:draftBranchHours},uniqueRequestId(),draftPartners);
    if(!draft)return showMessage('Registro de prueba','Selecciona un socio ficticio e introduce ciudad, moneda y horario válidos.');
    setDraftBranches(items=>[...items,draft]);
    setDraftBranchCity('');
  }

  function navigate(to) {
    setScreen(to);
    setAmount('');
    setRecipientCode('');
    pendingRef.current = null;
    setSelectedReceiptId(null);
  }

  async function shareReceipt(op) {
    const receipt = formatDemoReceipt(op, userId, language);
    if (!receipt) return showMessage('Comprobante', 'No fue posible preparar esta operación.');
    try {
      await Share.share({ message: receipt });
    } catch (error) {
      showMessage('Compartir comprobante', 'No fue posible abrir el menú para compartir.');
    }
  }

  return (
    <LanguageContext.Provider value={language}>
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07111f" translucent />
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.brandHeader}>
          <View style={styles.brandIcon}><Text style={styles.brandIconText}>◎</Text></View>
          <View style={styles.brandWords}>
            <Text style={styles.logo}>MONEDA MUNDIAL</Text>
            <Text style={styles.sub}>Tu mundo, una billetera</Text>
          </View>
          <View style={styles.versionPill}><Text style={styles.versionText}>2.0</Text></View>
        </View>
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>MODO DEMOSTRACIÓN · SIN DINERO REAL</Text>
        </View>

        {authLoading ? <Text style={styles.loadingText}>Estamos preparando tu cuenta</Text> : !session && screen === 'RecuperarAcceso' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Recuperar mi contraseña</Text>
            <Text style={styles.muted}>Introduce tu correo. Recibirás un enlace seguro de recuperación para abrir en este teléfono.</Text>
            <TextInput style={styles.input} placeholder="Correo electrónico"
              accessibilityLabel="Correo para recuperación"
              placeholderTextColor="#9fb1c8" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} value={recoveryEmail}
              onChangeText={setRecoveryEmail} />
            <Btn title={recoveryBusy ? 'Enviando...' : 'Enviar enlace de recuperación'}
              disabled={recoveryBusy} onPress={requestPasswordReset} />
            <Btn title="← Volver a iniciar sesión" secondary
              disabled={recoveryBusy} onPress={() => setScreen('Inicio')} />
          </View>
        ) : !session && screen === 'VerificarCodigo' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Revisa tu correo</Text>
            <Text style={styles.muted}>Abre el enlace de recuperación enviado a {recoveryEmail} en este teléfono. Regresarás a Moneda Mundial para crear una contraseña nueva.</Text>
            <Btn title="Reenviar enlace" secondary disabled={recoveryBusy} onPress={requestPasswordReset} />
            <Btn title="← Volver" secondary disabled={recoveryBusy} onPress={() => setScreen('RecuperarAcceso')} />
          </View>
        ) : session && screen === 'NuevaContrasena' ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Crea una contraseña nueva</Text>
            <Text style={styles.muted}>Tu correo ya está verificado. Elige una contraseña única de al menos 12 caracteres.</Text>
            <TextInput style={styles.input} placeholder="Nueva contraseña"
              accessibilityLabel="Nueva contraseña"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={newPassword} onChangeText={setNewPassword} />
            <TextInput style={styles.input} placeholder="Confirmar nueva contraseña"
              accessibilityLabel="Confirmar contraseña nueva"
              placeholderTextColor="#9fb1c8" autoCapitalize="none"
              secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
            <Btn title={recoveryBusy ? 'Guardando...' : 'Guardar nueva contraseña'}
              disabled={recoveryBusy} onPress={saveNewPassword} />
            <Text style={styles.muted}>Nunca compartas tu código ni contraseña con otras personas.</Text>
          </View>
        ) : !session ? (
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
            <Btn title="¿Olvidaste tu contraseña?" secondary disabled={authBusy}
              onPress={() => { setRecoveryEmail(email.trim().toLowerCase()); setScreen('RecuperarAcceso'); }} />
            <Text style={styles.muted}>Cada cuenta nueva recibe 10,000 MWD ficticios. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.</Text>
          </View>
        ) : (
          <>
            {screen !== 'Inicio' && <Btn title="← Volver al inicio" secondary onPress={() => navigate('Inicio')} disabled={busy} />}
            {screen === 'Inicio' && <>
              <View style={styles.hero}>
                <View style={styles.heroTopLine}>
                  <Text style={styles.heroEyebrow}>BILLETERA MUNDIAL</Text>
                  <Text style={styles.heroBadge}>MWD · PRUEBA</Text>
                </View>
                <Text style={styles.balanceCaption}>Saldo disponible</Text>
                <Text style={styles.balance}>{wallet ? formatMWD(wallet.balance_cents) : 'Consultando...'}</Text>
                <Text style={styles.balanceUnit}>MWD · créditos ficticios</Text>
                <Text style={styles.realMoneyLocked}>Saldo real: no habilitado. Los MWD de prueba no son dinero y no se pueden retirar.</Text>
                <View style={styles.heroDivider} />
                <Text style={styles.walletLabel}>TU IDENTIFICADOR DE BILLETERA</Text>
                <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.heroCode}>{wallet?.account_code || 'Preparando cuenta'}</Text>
                <Btn title="Compartir código para recibir" secondary
                  onPress={() => shareDemoCode('wallet', wallet?.account_code)} disabled={!wallet} />
              </View>
              <Text style={styles.sectionEyebrow}>MOVIMIENTOS</Text>
              <Text style={styles.sectionTitle}>¿Qué quieres hacer hoy?</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enviar MWD de demostración"
                  style={styles.quickAction} onPress={() => navigate('Transferir')} disabled={!wallet}>
                  <Text style={styles.quickIcon}>⇄</Text><Text style={styles.quickText}>Enviar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Recibir MWD de demostración"
                  style={styles.quickAction} onPress={() => navigate('Cuenta')}>
                  <Text style={styles.quickIcon}>↓</Text><Text style={styles.quickText}>Recibir</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pagar a un comercio de demostración"
                  style={styles.quickAction} onPress={() => navigate('PagarComercio')}>
                  <Text style={styles.quickIcon}>◇</Text><Text style={styles.quickText}>Pagar</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver actividad"
                  style={styles.quickAction} onPress={() => navigate('Historial')}>
                  <Text style={styles.quickIcon}>≡</Text><Text style={styles.quickText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.70}>Actividad</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionEyebrow}>SERVICIOS</Text>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Más opciones</Text>
                <Btn title="Aportaciones de demostración" secondary onPress={() => navigate('Aportar')} disabled={!wallet} />
                <Btn title="Mi comercio y solicitudes de cobro" secondary onPress={() => navigate('Comercio')} />
                <Btn title="Agregar dinero a mi billetera (próximamente)"
                  secondary onPress={() => navigate('AgregarDineroInformacion')} />
                <Btn title="Enviar sin tener saldo (próximamente)"
                  secondary onPress={() => navigate('EnviarSinSaldoInformacion')} />
                <Btn title={syncing ? 'Actualizando cuenta...' : 'Actualizar saldo e historial'} secondary
                  onPress={() => refreshAccount()} disabled={syncing} />
                <Btn title="Países del mundo y disponibilidad" secondary onPress={() => { navigate('PaisesMundo'); loadWorldCountries(); }} />
                <Btn title="Simulador internacional de comisiones" secondary onPress={() => navigate('SimuladorInternacional')} />
                <Btn title="Retiro de efectivo con código (demostración)" secondary onPress={() => { navigate('RetiroEfectivoDemo'); loadWorldCountries(); }} />
                <Btn title="Configuración" secondary onPress={() => navigate('Configuracion')} />
                <Btn title="Administración" secondary onPress={() => navigate('Admin')} />
              </View>
              <View style={styles.accountStrip}>
                <Text style={styles.accountText} numberOfLines={1}>{maskEmail(session.user.email)}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={logout} style={styles.logoutButton}>
                  <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </>}

            {screen === 'RetiroEfectivoDemo' && <View style={styles.card}>
              <Text style={styles.heading}>Retiro de efectivo con código</Text>
              <Text style={styles.warning}>DEMOSTRACIÓN SIN VALOR · NO COBRABLE · NO ES UNA REMESA</Text>
              <Text style={styles.muted}>Ejemplo: enviar desde Estados Unidos hacia cualquier destino del catálogo mundial sin que el destinatario tenga teléfono ni cuenta en la aplicación.</Text>
              <Text style={styles.muted}>Alcance de diseño mundial. Ningún país tiene agentes ni pagos reales habilitados.</Text>
              <CountrySelector title="País o territorio de destino (solo diseño)"
                options={normalizeCashPickupCountries(worldCountries).map(item => ({code:item.code,label:countryName(item.code,item.name,language)}))}
                selectedCode={pickupDestination}
                onChoose={code => { setPickupDestination(code); setPickupSample(null); }} />
              <Btn title={worldLoading ? 'Consultando catálogo...' : 'Actualizar catálogo mundial'} secondary
                disabled={worldLoading} onPress={loadWorldCountries} />
              <Text style={styles.small}>Destinos en catálogo: {normalizeCashPickupCountries(worldCountries).length}. Retiros reales habilitados: 0.</Text>
              <Text style={styles.panelTitle}>Sucursales totalmente ficticias para probar búsquedas</Text>
              <Text style={styles.warning}>Estos establecimientos son INVENTADOS. No existen direcciones, bancos afiliados ni agentes autorizados.</Text>
              <TextInput style={styles.input} placeholder="Buscar ciudad, agente o moneda" value={agentSearch}
                placeholderTextColor="#9fb1c8" onChangeText={setAgentSearch} />
              {searchDemoPayoutAgents(pickupDestination,agentSearch).map(agent=><View key={agent.id} style={styles.panel}>
                <Text style={styles.itemHeading}>{agent.name}</Text>
                <Text style={styles.small}>Ciudad de ejemplo: {agent.city} · {agent.countryCode}</Text>
                <Text style={styles.small}>Monedas de ejemplo: {agent.currencies.join(', ')}</Text>
                <Text style={styles.small}>Horario ficticio: {agent.hours}</Text>
                <Text style={styles.warning}>NO DISPONIBLE PARA COBRAR · AGENTE INVENTADO</Text>
              </View>)}
              {searchDemoPayoutAgents(pickupDestination,agentSearch).length===0 &&
                <Text style={styles.muted}>No hay sucursales ficticias de ejemplo para este destino o búsqueda. No implica disponibilidad real.</Text>}
              <Text style={styles.muted}>Importe hipotético en dólares estadounidenses (USD)</Text>
              <TextInput style={styles.input} value={pickupAmount} placeholder="Ejemplo: 100.00" keyboardType="decimal-pad"
                placeholderTextColor="#9fb1c8" onChangeText={value => { setPickupAmount(value); setPickupSample(null); }} />
              <Btn title="Generar código ficticio de ejemplo" onPress={prepareCashPickupSample}
                disabled={!normalizeCashPickupCountries(worldCountries).some(item => item.code === pickupDestination)} />
              {pickupSample && <View style={styles.panel}>
                <Text style={styles.panelTitle}>Código de ejemplo · NO VÁLIDO PARA COBRAR</Text>
                <Text selectable style={styles.pickupDemoCode}>{pickupSample.referenceCode}</Text>
                <Text style={styles.small}>Importe simulado de origen: {formatMWD(pickupSample.amountCents)} USD</Text>
                <Text style={styles.small}>Estado: SOLO MUESTRA, SIN FONDOS DEPOSITADOS</Text>
                <Text style={styles.small}>Monto entregable, tipo de cambio y comisión: no disponibles.</Text>
                <Text style={styles.warning}>Este código NO sirve en bancos, agencias ni comercios. No representa dinero ni un pago confirmado.</Text>
              </View>}
              <Text style={styles.panelTitle}>¿Cómo funcionará con socios autorizados?</Text>
              <Text style={styles.small}>1. El remitente solicita un envío y recibe la confirmación del proveedor financiero autorizado.</Text>
              <Text style={styles.small}>2. El beneficiario acude a un agente asociado con la referencia real y su identificación válida.</Text>
              <Text style={styles.small}>3. El agente verifica identidad, fondos y cumplimiento antes de entregar dinero y anular la referencia para nuevos cobros.</Text>
              <Text style={styles.warning}>Actualmente no tenemos agentes habilitados ni convenios de pago en ningún país. No introduzcas documentos de identidad ni pagues dinero en esta simulación.</Text>
            </View>}

            {screen === 'AgregarDineroInformacion' && <View style={styles.card}>
              <Text style={styles.heading}>Agregar dinero a la billetera</Text>
              <Text style={styles.warning}>FUNCIÓN FUTURA · NO DISPONIBLE · NO SE ACEPTA DINERO REAL</Text>
              <Text style={styles.muted}>En el futuro, una billetera regulada permitirá añadir fondos con métodos autorizados. Hoy no puedes recargar ni retirar dinero.</Text>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Cuenta bancaria autorizada</Text>
                <Text style={styles.small}>Podrá utilizarse cuando un proveedor financiero confirme la titularidad, la operación y la disponibilidad de los fondos.</Text>
              </View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Tarjeta de débito compatible</Text>
                <Text style={styles.small}>Podrá utilizarse si un procesador autorizado admite la recarga en el país y confirma el pago.</Text>
              </View>
              <Text style={styles.realMoneyLocked}>Saldo real: todavía no existe una billetera financiera habilitada.</Text>
              <Text style={styles.warning}>Los 10,000 MWD iniciales son créditos ficticios; no se transforman en dólares. No ingreses datos de tarjetas ni cuentas.</Text>
              <Btn title="Recargar dinero real: no disponible" disabled onPress={() => {}} />
              <Btn title="Ver mi billetera de prueba" secondary onPress={() => navigate('Inicio')} />
            </View>}

            {screen === 'EnviarSinSaldoInformacion' && <View style={styles.card}>
              <Text style={styles.heading}>Enviar dinero sin recargar saldo</Text>
              <Text style={styles.warning}>FUNCIÓN FUTURA · NO DISPONIBLE · SIN TRANSFERENCIAS REALES</Text>
              <Text style={styles.muted}>Cuando tengamos autorizaciones y socios financieros, una persona podrá financiar un envío directamente sin mantener dinero almacenado en Moneda Mundial.</Text>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Pagar desde cuenta bancaria</Text>
                <Text style={styles.small}>El proveedor autorizado cobrará y verificará los fondos antes de procesar el envío.</Text>
              </View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Pagar con tarjeta compatible</Text>
                <Text style={styles.small}>El procesador tokenizará los datos sensibles de la tarjeta; Moneda Mundial no almacenará números completos ni CVV.</Text>
              </View>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Recibir en el país de destino</Text>
                <Text style={styles.small}>Cuenta bancaria o tarjeta receptora elegible, únicamente en rutas activadas legalmente y por socios autorizados.</Text>
              </View>
              <Text style={styles.warning}>No hay rutas habilitadas para dinero real. El simulador solo calcula comisiones hipotéticas y no envía fondos.</Text>
              <Btn title="Enviar dinero real: no disponible" disabled onPress={() => {}} />
              <Btn title="Probar simulador internacional" secondary onPress={() => navigate('SimuladorInternacional')} />
            </View>}

            {screen === 'Configuracion' && <View style={styles.card}>
              <Text style={styles.heading}>Configuración</Text>
              <Text style={styles.panelTitle}>Idioma de la aplicación</Text>
              <Text style={styles.muted}>Idioma actual: {language === 'en' ? 'English' : 'Español'}</Text>
              <Btn title={(languageMode==='auto' ? '✓ ' : '')+'Automático (idioma del teléfono)'}
                secondary={languageMode!=='auto'} onPress={()=>chooseLanguage('auto')} />
              <Btn title={(languageMode==='es' ? '✓ ' : '')+'Español'}
                secondary={languageMode!=='es'} onPress={()=>chooseLanguage('es')} />
              <Btn title={(languageMode==='en' ? '✓ ' : '')+'English'}
                secondary={languageMode!=='en'} onPress={()=>chooseLanguage('en')} />
              <Text style={styles.small}>Idioma guardado en este dispositivo</Text>
            </View>}

            {screen === 'Transferir' && <View style={styles.card}>
              <Text style={styles.heading}>Transferencia de prueba</Text>
              <Text style={styles.muted}>Pide a la otra persona su código MWD para enviarle créditos de demostración.</Text>
              <Text style={styles.muted}>Código de billetera del destinatario</Text>
              <TextInput style={styles.input} placeholder="MWD-0123456789ABCDEF"
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

            {screen === 'Comercio' && <>
              <View style={styles.card}>
                <Text style={styles.heading}>Mi comercio de demostración</Text>
                <Text style={styles.muted}>Registra tu comercio para emitir cobros de prueba en MWD.</Text>
                <TextInput style={styles.input} placeholder="Nombre del comercio"
                  placeholderTextColor="#9fb1c8" maxLength={120}
                  value={merchantName} onChangeText={setMerchantName} />
                <TextInput style={styles.input} placeholder="País ISO, ejemplo US"
                  placeholderTextColor="#9fb1c8" maxLength={2}
                  autoCapitalize="characters" autoCorrect={false}
                  value={merchantCountry} onChangeText={setMerchantCountry} />
                <Btn title={merchantBusy ? 'Guardando...' : 'Guardar comercio de prueba'}
                  onPress={saveMerchant} disabled={merchantBusy} />
              </View>
              {merchant && <View style={styles.card}>
                <Text style={styles.heading}>Crear solicitud de cobro</Text>
                <Text style={styles.muted}>Solo créditos ficticios. No se emiten facturas ni se cobra dinero real.</Text>
                <TextInput style={styles.input} placeholder="Cantidad en MWD"
                  placeholderTextColor="#9fb1c8" keyboardType="decimal-pad"
                  value={merchantAmount} onChangeText={setMerchantAmount} />
                <TextInput style={styles.input} placeholder="Descripción (opcional)"
                  placeholderTextColor="#9fb1c8" maxLength={240}
                  value={merchantDescription} onChangeText={setMerchantDescription} />
                <Btn title={merchantBusy ? 'Procesando...' : 'Generar cobro ficticio'}
                  onPress={createMerchantRequest} disabled={merchantBusy} />
              </View>}
              <Text style={styles.heading}>Mis últimas solicitudes</Text>
              <Btn title="Actualizar solicitudes" secondary onPress={() => refreshMerchant()}
                disabled={merchantBusy} />
              {merchantRequests.length === 0 &&
                <Text style={styles.muted}>Todavía no hay solicitudes de cobro.</Text>}
              {merchantRequests.map(request => <View style={styles.entry} key={request.id}>
                <Text style={styles.itemHeading}>{formatMWD(request.amount_cents)} MWD ficticios</Text>
                <Text style={styles.small}>Estado: {demoPaymentStatus(request.status, language)}</Text>
                {request.description ? <Text style={styles.small}>{request.description}</Text> : null}
                <Text selectable style={styles.code}>{request.id}</Text>
                {request.status === 'pending' ? <>
                  <Text style={styles.muted}>Comparte este código con el cliente de prueba.</Text>
                  <Btn title="Compartir código de cobro" secondary
                    onPress={() => shareDemoCode('payment', request.id)} />
                </> : <Text style={styles.muted}>Esta solicitud ya no admite nuevos pagos ficticios.</Text>}
                {request.status === 'pending' &&
                  <Btn title="Cancelar solicitud" secondary disabled={merchantBusy}
                    onPress={() => cancelMerchantRequest(request.id)} />}
              </View>)}
            </>}

            {screen === 'PagarComercio' && <View style={styles.card}>
              <Text style={styles.heading}>Pagar a un comercio de prueba</Text>
              <Text style={styles.muted}>Pide al comercio el identificador UUID de su solicitud de cobro.</Text>
              <TextInput style={styles.input} placeholder="Identificador de solicitud UUID"
                placeholderTextColor="#9fb1c8" autoCapitalize="none"
                autoCorrect={false} value={paymentCode}
                onChangeText={value => { paymentLookupSequenceRef.current += 1; setPaymentCode(value); setPaymentPreview(null); }} />
              <Btn title={busy ? 'Consultando...' : 'Consultar cobro ficticio'}
                disabled={busy} onPress={lookupMerchantPayment} />
              {paymentPreview && <View>
                <Text style={styles.itemHeading}>Comercio: {paymentPreview.business_name}</Text>
                <Text style={styles.balance}>{formatMWD(paymentPreview.amount_cents)} MWD</Text>
                <Text style={styles.muted}>Estado: {demoPaymentStatus(paymentPreview.status, language)}</Text>
                {paymentPreview.description &&
                  <Text style={styles.muted}>{paymentPreview.description}</Text>}
                {paymentPreview.status === 'pending' &&
                  <Btn title={busy ? 'Procesando...' : 'Confirmar pago ficticio'}
                    disabled={busy} onPress={confirmMerchantPayment} />}
              </View>}
            </View>}

            {screen === 'Cuenta' && <View style={styles.card}>
              <Text style={styles.heading}>Mi identificador para recibir</Text>
              <Text selectable style={styles.code}>{wallet?.account_code}</Text>
              <Text style={styles.muted}>Comparte este identificador con otra cuenta de prueba. No compartas tu contraseña.</Text>
              <Btn title="Compartir código de billetera" secondary
                onPress={() => shareDemoCode('wallet', wallet?.account_code)} disabled={!wallet} />
              <Text style={styles.small}>Correo: {maskEmail(session.user.email)}</Text>
            </View>}

            {screen === 'Historial' && <>
              <Text style={styles.heading}>Mis últimos movimientos</Text>
              {operations.length === 0 && <Text style={styles.muted}>Todavía no hay movimientos en línea.</Text>}
              {operations.map(op => {
                const movement = classifyDemoOperation(op, userId);
                if (!movement) return null;
                return (
                  <View style={styles.entry} key={op.id}>
                    <Text style={styles.itemHeading}>{translate(movement.label, language)}</Text>
                    <Text style={styles.amount}>{movement.sign}{formatMWD(op.amount_cents)} MWD</Text>
                    <Text style={styles.muted}>{formatLocalizedDate(op.created_at, language)}</Text>
                    <Btn title={selectedReceiptId === op.id ? 'Ocultar comprobante de prueba' : 'Ver comprobante de prueba'}
                      secondary onPress={() => setSelectedReceiptId(selectedReceiptId === op.id ? null : op.id)} />
                    {selectedReceiptId === op.id && (
                      <View style={styles.panel}>
                        <Text style={styles.small}>COMPROBANTE FICTICIO · SIN DINERO REAL</Text>
                        <Text style={styles.muted}>Referencia:</Text>
                        <Text selectable style={styles.code}>{op.id}</Text>
                        <Text style={styles.muted}>Tipo: {translate(movement.label, language)}</Text>
                        <Text style={styles.muted}>Monto: {movement.sign}{formatMWD(op.amount_cents)} MWD de prueba</Text>
                        <Text style={styles.muted}>Fecha: {formatLocalizedDate(op.created_at, language)}</Text>
                        <Text style={styles.warning}>Este comprobante NO acredita ningún movimiento de dinero real.</Text>
                        <Btn title="Compartir comprobante ficticio" secondary onPress={() => shareReceipt(op)} />
                      </View>
                    )}
                  </View>
                );
              })}
            </>}

            {screen === 'PaisesMundo' && <View style={styles.card}>
              <Text style={styles.heading}>Países y territorios del mundo</Text>
              <Text style={styles.warning}>CATÁLOGO INFORMATIVO · NINGÚN PAÍS HABILITADO PARA DINERO REAL</Text>
              <Text style={styles.muted}>La lista usa códigos internacionales ISO. Incluye territorios además de países. La disponibilidad se habilitará únicamente después de los permisos, controles y acuerdos bancarios aplicables.</Text>
              <Btn title={worldLoading ? 'Consultando catálogo...' : 'Actualizar catálogo mundial'}
                secondary disabled={worldLoading} onPress={loadWorldCountries} />
              {worldCountries && <>
                <Text style={styles.panelTitle}>Destinos registrados: {worldCountries.length}</Text>
                <TextInput style={styles.input} value={worldQuery} placeholder="Buscar país o territorio"
                  placeholderTextColor="#9fb1c8" autoCorrect={false} onChangeText={setWorldQuery}/>
                {(() => {
                  const norm = s => String(s || '').toLowerCase().normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '').trim();
                  const query = norm(worldQuery);
                  const filtered = worldCountries.filter(item =>
                    norm(item.name).includes(query) ||
                    norm(countryName(item.code,item.name,language)).includes(query) ||
                    norm(item.code).includes(query));
                  return <View>
                    <Text style={styles.small}>Resultados: {filtered.length}{filtered.length > 25 ? ' · mostrando los primeros 25' : ''}</Text>
                    {filtered.slice(0,25).map(item => <View key={item.code} style={styles.countryOption}>
                      <Text style={styles.countryOptionText}>{countryName(item.code,item.name,language)} ({item.code})</Text>
                      <Text style={styles.small}>{item.demoAvailable
                        ? 'Simulaciones disponibles · NO dinero real'
                        : 'Pendiente de preparación y autorizaciones'}</Text>
                      <Text style={styles.muted}>Transferencias reales: no disponibles</Text>
                      {item.demoAvailable && <Btn title="Ver simulación de este destino" secondary
                        onPress={() => { quoteSequenceRef.current += 1; setDemoDestination(item.code); setInternationalQuote(null); navigate('SimuladorInternacional'); }} />}
                    </View>)}
                    {filtered.length === 0 && <Text style={styles.muted}>No encontramos ese nombre. Comprueba la escritura.</Text>}
                  </View>;
                })()}
              </>}
            </View>}

            {screen === 'SimuladorInternacional' && <View style={styles.card}>
              <Text style={styles.heading}>Simulador internacional MWD</Text>
              <Text style={styles.warning}>CÁLCULOS HIPOTÉTICOS · SIN BANCOS · SIN DINERO REAL</Text>
              <Text style={styles.muted}>País de origen: Estados Unidos (USD). Comisiones y costos de demostración, NO tarifas aprobadas.</Text>
              <CountrySelector title="País de destino"
                options={DEMO_CORRIDORS.map(route => ({code: route.code, label: countryName(route.code, route.country, language)}))}
                selectedCode={demoDestination}
                onChoose={code => { quoteSequenceRef.current += 1; setDemoDestination(code); setInternationalQuote(null); }} />
              <Text style={styles.panelTitle}>Método de origen simulado</Text>
              <Btn title={demoMethod === 'bank' ? '✓ Cuenta bancaria (simulada)' : 'Cuenta bancaria (simulada)'}
                secondary={demoMethod !== 'bank'} onPress={() => { quoteSequenceRef.current += 1; setDemoMethod('bank'); setInternationalQuote(null); }} />
              <Btn title={demoMethod === 'card' ? '✓ Tarjeta (simulada)' : 'Tarjeta (simulada)'}
                secondary={demoMethod !== 'card'} onPress={() => { quoteSequenceRef.current += 1; setDemoMethod('card'); setInternationalQuote(null); }} />
              <TextInput style={styles.input} value={demoAmount}
                placeholder="Importe de ejemplo en USD" placeholderTextColor="#9fb1c8"
                keyboardType="decimal-pad" onChangeText={value => { quoteSequenceRef.current += 1; setDemoAmount(value); setInternationalQuote(null); }} />
              <Btn title={quoteBusy ? 'Calculando...' : 'Calcular cotización ficticia'}
                disabled={quoteBusy} onPress={fetchDemoInternationalQuote} />
              {internationalQuote && (() => {
                const q = internationalQuote;
                return <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Presupuesto de prueba</Text>
                  <Text style={styles.small}>Destino: {q.country} ({q.destinationCurrency})</Text>
                  <Text style={styles.small}>Envío simulado: {formatMWD(q.amountCents)} USD</Text>
                  <Text style={styles.small}>Comisión hipotética: {formatMWD(q.feeCents)} USD</Text>
                  <Text style={styles.small}>Total simulado: {formatMWD(q.totalPayCents)} USD</Text>
                  {adminRole === 'owner' && typeof q.costEstimateCents === 'number' &&
                    <Text style={styles.small}>Costo variable de ejemplo: {formatMWD(q.costEstimateCents)} USD</Text>}
                  {adminRole === 'owner' && typeof q.illustrativeMarginCents === 'number' &&
                    <Text style={styles.small}>Margen parcial ilustrativo: {formatMWD(q.illustrativeMarginCents)} USD</Text>}
                  {adminRole === 'owner' && needsDemoFeeReview(q) &&
                    <View><Text style={styles.warning}>ALERTA DE SIMULACIÓN: el costo ilustrativo supera la comisión. Margen negativo; revisar costos y tarifas antes de considerar este corredor. No es una cotización real.</Text><Text style={styles.warning}>Brecha de costos estimada: {formatMWD(demoFeeShortfallCents(q))} USD. Esta diferencia NO incluye otros costos ni es una tarifa sugerida.</Text></View>}
                  <Text style={styles.small}>{q.receiverAmountCents === null
                    ? 'Importe final no disponible: tipo de cambio real pendiente.'
                    : 'Recepción simulada: ' + formatMWD(q.receiverAmountCents) + ' USD'}</Text>
                  <Text style={styles.warning}>La estimación omite costos regulatorios, fiscales, FX y otros. No constituye cotización real ni utilidad neta.</Text>
                </View>;
              })()}
            </View>}

            {screen === 'Admin' && <View style={styles.card}>
              <Text style={styles.heading}>Administración MWD</Text>
              {adminRole === 'owner' ? (
                <View>
                  <Text style={styles.sectionEyebrow}>ACCESO DEL PROPIETARIO VERIFICADO</Text>
                  <Text style={styles.muted}>Resumen global de demostración, sin información personal de otros usuarios.</Text>
                  <Btn title={ownerLoading ? 'Consultando...' : 'Consultar resumen del propietario'}
                    secondary disabled={ownerLoading} onPress={refreshOwnerSummary} />
                  {ownerSummary && <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Resumen del sistema de prueba</Text>
                    <Text style={styles.small}>Billeteras: {ownerSummary.cuentas}</Text>
                    <Text style={styles.small}>Comercios: {ownerSummary.comercios}</Text>
                    <Text style={styles.small}>Transferencias: {ownerSummary.transferencias}</Text>
                    <Text style={styles.small}>Aportaciones: {ownerSummary.aportaciones}</Text>
                    <Text style={styles.small}>Cobros pagados: {ownerSummary.cobros_pagados}</Text>
                    <Text style={styles.small}>Saldo conjunto ficticio: {formatMWD(ownerSummary.saldo_demo_centavos)} MWD</Text>
                  </View>}
                  <Text style={styles.sectionEyebrow}>TARIFAS INTERNACIONALES FICTICIAS</Text>
                  <Btn title="Consultar tarifas de prueba" secondary onPress={refreshDemoFeeCatalog} />
                  {feeCatalog && <View style={styles.panel}>
                    <Text style={styles.small}>Países configurados: {feeCatalog.length}</Text>
                    <CountrySelector title="Selecciona el país que deseas administrar"
                      options={feeCatalog.map(route => ({
                        code: route.destination, label: countryName(route.destination, route.country, language),
                        info: (route.feeBps / 100).toFixed(2) + '%'
                      }))}
                      selectedCode={feeCountry} onChoose={code => {
                        const route = feeCatalog.find(item => item.destination === code);
                        if (!route) return;
                        setFeeCountry(code);
                        setFeePercent((route.feeBps / 100).toFixed(2));
                        setFeeMinimum(formatMWD(route.minFeeCents));
                      }} />
                    <Text style={styles.muted}>Porcentaje de comisión de prueba</Text>
                    <TextInput style={styles.input} value={feePercent} keyboardType="decimal-pad"
                      placeholderTextColor="#9fb1c8" onChangeText={setFeePercent} />
                    <Text style={styles.muted}>Tarifa mínima ficticia en USD</Text>
                    <TextInput style={styles.input} value={feeMinimum} keyboardType="decimal-pad"
                      placeholderTextColor="#9fb1c8" onChangeText={setFeeMinimum} />
                    <Btn title={feeSaving ? 'Guardando...' : 'Guardar tarifa ficticia'}
                      onPress={saveOwnerDemoFee} disabled={feeSaving} />
                    <Text style={styles.warning}>Solo modifica cotizaciones simuladas. Queda auditado en Supabase; no activa pagos.</Text>
                  </View>}
                  <Text style={styles.sectionEyebrow}>FUTUROS BANCOS Y AGENTES · SOLO BORRADORES</Text>
                  <View style={styles.panel}>
                    <Text style={styles.warning}>PANEL DE PRUEBA. Los nombres son inventados y los registros solo existen mientras está abierta esta sesión de la aplicación. Ningún agente acepta dinero.</Text>
                    <Text style={styles.small}>Socios ficticios: {summarizeDemoPayoutAdmin(draftPartners,draftBranches).partnersInDraft} · Sucursales ficticias: {draftBranches.length} · Agentes reales autorizados: 0</Text>
                    <Text style={styles.muted}>Nombre ficticio de la entidad</Text>
                    <TextInput style={styles.input} value={draftPartnerName} onChangeText={setDraftPartnerName} placeholder="Ejemplo: Banco de Prueba" placeholderTextColor="#9fb1c8" />
                    <CountrySelector title="País del borrador" options={normalizeCashPickupCountries(worldCountries).map(c=>({code:c.code,label:countryName(c.code,c.name,language)}))}
                      selectedCode={draftPartnerCountry} onChoose={setDraftPartnerCountry} />
                    <Btn title={worldLoading?'Consultando países...':'Cargar catálogo mundial'} secondary disabled={worldLoading} onPress={loadWorldCountries} />
                    <Btn title={draftPartnerType==='bank'?'✓ Banco ficticio':'Banco ficticio'} secondary={draftPartnerType!=='bank'} onPress={()=>setDraftPartnerType('bank')} />
                    <Btn title={draftPartnerType==='remittance_operator'?'✓ Remesadora ficticia':'Remesadora ficticia'} secondary={draftPartnerType!=='remittance_operator'} onPress={()=>setDraftPartnerType('remittance_operator')} />
                    <Btn title={draftPartnerType==='cash_agent_network'?'✓ Red de agentes ficticia':'Red de agentes ficticia'} secondary={draftPartnerType!=='cash_agent_network'} onPress={()=>setDraftPartnerType('cash_agent_network')} />
                    <Btn title="Crear borrador de entidad ficticia" onPress={createPartnerDraft} disabled={!normalizeCashPickupCountries(worldCountries).some(c=>c.code===draftPartnerCountry)} />
                    {draftPartners.map(p=><View key={p.id} style={styles.entry}>
                      <Text style={styles.itemHeading}>{p.name} · {p.countryCode}</Text>
                      <Text style={styles.small}>Tipo: {p.type} · Estado: BORRADOR SIN LICENCIA</Text>
                      <Btn title="Seleccionar para crear sucursal" secondary onPress={()=>setDraftSelectedPartner(p.id)} />
                      <Btn title="Eliminar borrador ficticio" secondary onPress={()=>{
                        const next=deleteDemoPartnerDraft(draftPartners,draftBranches,p.id);
                        setDraftPartners(next.partners);setDraftBranches(next.branches);
                        if(draftSelectedPartner===p.id)setDraftSelectedPartner('');
                      }} />
                    </View>)}
                    <Text style={styles.panelTitle}>Nueva sucursal ficticia</Text>
                    <Text style={styles.small}>Socio seleccionado: {draftPartners.find(p=>p.id===draftSelectedPartner)?.name||'Ninguno'}</Text>
                    <TextInput style={styles.input} value={draftBranchCity} onChangeText={setDraftBranchCity} placeholder="Ciudad de ejemplo" placeholderTextColor="#9fb1c8" />
                    <TextInput style={styles.input} value={draftBranchCurrency} onChangeText={v=>setDraftBranchCurrency(v.toUpperCase())} placeholder="Moneda ISO: NIO" placeholderTextColor="#9fb1c8" autoCapitalize="characters" />
                    <TextInput style={styles.input} value={draftBranchHours} onChangeText={setDraftBranchHours} placeholder="Horario ficticio" placeholderTextColor="#9fb1c8" />
                    <Btn title="Crear sucursal ficticia" disabled={!draftSelectedPartner} onPress={createBranchDraft} />
                    {draftBranches.map(b=><View key={b.id} style={styles.entry}>
                      <Text style={styles.itemHeading}>Sucursal ficticia · {b.city} ({b.countryCode})</Text>
                      <Text style={styles.small}>Moneda de ejemplo: {b.currencyCode} · Horario ficticio: {b.hours}</Text>
                      <Text style={styles.warning}>BORRADOR · NUNCA AUTORIZADO PARA COBRAR</Text>
                    </View>)}
                    <Text style={styles.warning}>Sin conexión a bancos ni sistema de liquidación. La aplicación no permite activar estos registros ni generar códigos cobrables.</Text>
                  </View>
                  <Text style={styles.muted}>No se permite cambiar roles, saldos ni operaciones desde este panel.</Text>
                </View>
              ) : adminRole === 'support' ? (
                <Text style={styles.muted}>Rol de soporte reconocido. Sin funciones administrativas habilitadas.</Text>
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
    </LanguageContext.Provider>
  );
}

// Identidad visual 2.0: azul marino profundo, turquesa y dorado sobrio.
// Interfaz estática sin animaciones. Todos los saldos siguen siendo ficticios.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071321' },
  // Reserva espacio real para las barras de estado y navegacion en Android edge-to-edge.
  // El margen queda fijo mientras se desplaza el contenido: ninguna etiqueta se oculta tras la hora.
  scrollArea: { marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
    marginBottom: Platform.OS === 'android' ? 28 : 0 },
  body: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 84, maxWidth: 620, width: '100%', alignSelf: 'center' },
  brandHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  brandIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#114858', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: '#3ED4C5' },
  brandIconText: { fontSize: 27, color: '#D5B57A', fontWeight: '700' },
  brandWords: { flex: 1 },
  logo: { color: '#FFFFFF', fontSize: 18, letterSpacing: 0.8, fontWeight: '800' },
  sub: { color: '#A9BCCB', marginTop: 3, fontSize: 12 },
  versionPill: { borderWidth: 1, borderColor: '#4C6878', borderRadius: 9, paddingVertical: 5, paddingHorizontal: 9 },
  versionText: { color: '#C6DDE0', fontSize: 12, fontWeight: '700' },
  demoBanner: { padding: 12, backgroundColor: '#263323', borderRadius: 11, borderWidth: 1, borderColor: '#6B653A', marginBottom: 17 },
  demoBannerText: { color: '#F3D49A', textAlign: 'center', fontWeight: '700', letterSpacing: 0.5, fontSize: 11 },
  warning: { color: '#F3D49A', textAlign: 'center', marginVertical: 19, fontSize: 12 },
  hero: { backgroundColor: '#123849', borderRadius: 23, padding: 22, marginBottom: 25, borderWidth: 1, borderColor: '#286B78' },
  heroTopLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 29, gap: 8 },
  heroEyebrow: { color: '#D6EAEC', fontSize: 11, letterSpacing: 1.4, fontWeight: '800' },
  heroBadge: { color: '#061E23', backgroundColor: '#7FE0CA', paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden', borderRadius: 12, fontSize: 10, fontWeight: '800', flexShrink: 0 },
  balanceCaption: { color: '#C2DBE2', fontSize: 14 },
  balance: { color: '#FFFFFF', fontSize: 39, fontWeight: '800', marginTop: 5, letterSpacing: -1.1 },
  balanceUnit: { color: '#BBD0D7', marginTop: 5, marginBottom: 12, fontSize: 13 },
  realMoneyLocked: { color: '#F3D49A', fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 12 },
  heroDivider: { borderBottomColor: '#517585', borderBottomWidth: 1, marginVertical: 17 },
  walletLabel: { color: '#C1D6DB', fontSize: 10, letterSpacing: 0.8, fontWeight: '700' },
  heroCode: { color: '#FFFFFF', fontSize: 15, marginTop: 8, marginBottom: 17, fontWeight: '700', letterSpacing: 0 },
  pickupDemoCode: { color: '#8FE6D4', fontSize: 15, fontWeight: '800', marginVertical: 13 },
  sectionEyebrow: { color: '#7FE0CA', fontSize: 11, letterSpacing: 1.1, fontWeight: '700', marginBottom: 6 },
  sectionTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 16 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 25, rowGap: 10 },
  quickAction: { width: '48.5%', minHeight: 104, backgroundColor: '#122C3D', borderRadius: 15, paddingVertical: 15, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A5260' },
  quickIcon: { color: '#8FE6D4', fontSize: 27, marginBottom: 8, fontWeight: '600' },
  quickText: { color: '#EAF6F6', fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  panel: { backgroundColor: '#10293A', borderWidth: 1, borderColor: '#25495A', borderRadius: 17, padding: 16, marginBottom: 17 },
  panelTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  accountStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  accountText: { color: '#A6BCCC', flex: 1, marginRight: 9, fontSize: 12 },
  logoutButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#1F3A48' },
  logoutText: { color: '#D3E2E6', fontSize: 12, fontWeight: '700' },
  loadingText: { color: '#DFEEEE', textAlign: 'center', marginVertical: 28, fontSize: 15 },
  card: { backgroundColor: '#10293A', borderRadius: 17, padding: 20, marginBottom: 17, borderWidth: 1, borderColor: '#25495A' },
  heading: { color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginBottom: 13 },
  muted: { color: '#ABBECC', lineHeight: 21, marginBottom: 9 },
  small: { color: '#D4E0E7', marginTop: 6 },
  code: { color: '#8FE6D4', fontSize: 16, marginTop: 12, fontWeight: '700' },
  input: { backgroundColor: '#1C3A4E', color: '#FFFFFF', padding: 14, borderRadius: 11, marginVertical: 8, fontSize: 16 },
  countryPicker: { marginVertical: 10 },
  countryToggle: { backgroundColor: '#284658', borderRadius: 11, padding: 15,
    borderWidth: 1, borderColor: '#478E94' },
  countryToggleText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  countryOptions: { backgroundColor: '#163347', borderRadius: 12, padding: 9, marginTop: 9 },
  countryOption: { backgroundColor: '#284658', borderRadius: 9, marginVertical: 4,
    paddingVertical: 11, paddingHorizontal: 14 },
  countryOptionSelected: { backgroundColor: '#15887F' },
  countryOptionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  button: { backgroundColor: '#15887F', padding: 16, borderRadius: 11, marginBottom: 12, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#284658' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  entry: { backgroundColor: '#10293A', padding: 17, borderRadius: 13, marginBottom: 12 },
  itemHeading: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  amount: { color: '#FFFFFF', fontSize: 18, marginVertical: 8 },
  footer: { color: '#92AABB', textAlign: 'center', fontSize: 11, marginTop: 30 },
});
