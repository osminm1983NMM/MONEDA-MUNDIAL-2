// Moneda Mundial 2.0 - inventario conservador de preparación para lanzamiento.
// Las pruebas del prototipo no demuestran licencias, convenios, fondos ni permisos.
// El cliente JAMÁS puede declarar un país operativo, ni activar dinero real.
export const LAUNCH_CHECKS = Object.freeze([
  {id:'demo-wallet',category:'Técnico',title:'Billetera y transferencias ficticias',stage:'built_demo',
   next:'Mantener las pruebas aisladas; confirmar el comportamiento de la APK en el dispositivo.'},
  {id:'demo-cash-pickup',category:'Técnico',title:'Retiro de efectivo con código ficticio',stage:'built_demo',
   next:'Comprobar que las referencias DEMO nunca pueden cobrarse.'},
  {id:'demo-admin',category:'Técnico',title:'Registro de socios y revisiones administrativas',stage:'built_demo',
   next:'Verificar acceso propietario y persistencia sin datos reales de bancos.'},
  {id:'android-qa',category:'Técnico',title:'APK definitiva probada en dispositivos Android',stage:'needs_verification',
   next:'Probar navegación, cuenta, transferencias ficticias, formularios y cierre de sesión.'},
  {id:'appsec',category:'Seguridad',title:'Prueba independiente de seguridad, fraude y privacidad',stage:'needs_verification',
   next:'Auditar autenticación, control de acceso, cifrado, datos personales y resiliencia.'},
  {id:'company',category:'Legal',title:'Entidad jurídica y estructura regulatoria definida',stage:'external_required',
   next:'Obtener asesoría especializada y registrar la estructura legal apropiada.'},
  {id:'licenses',category:'Legal',title:'Licencias o socios autorizados para cada jurisdicción',stage:'external_required',
   next:'Confirmar obligaciones de transmisor de dinero en cada origen y destino.'},
  {id:'consumer',category:'Legal',title:'Divulgaciones, reclamaciones, cancelaciones e impuestos',stage:'external_required',
   next:'Revisar normativa local, tasas, cambio de moneda y derechos del consumidor.'},
  {id:'partners',category:'Financiero',title:'Acuerdos firmados con entidades pagadoras autorizadas',stage:'external_required',
   next:'Negociar y verificar convenios de origen, destino y agentes de efectivo.'},
  {id:'funds',category:'Financiero',title:'Custodia o salvaguarda de fondos y conciliación bancaria',stage:'external_required',
   next:'Diseñar y contratar liquidación, segregación, conciliación y devoluciones.'},
  {id:'risk',category:'Cumplimiento',title:'Programas AML/KYC, sanciones, monitoreo y límites',stage:'external_required',
   next:'Validar las políticas y sistemas con profesionales y proveedores regulados.'},
  {id:'cash',category:'Operaciones',title:'Prueba con agentes reales bajo contrato y autorización',stage:'external_required',
   next:'Realizar pruebas documentadas por corredor, moneda, sucursal y pago único.'},
  {id:'support',category:'Operaciones',title:'Atención al usuario, incidencias y soporte operativo',stage:'needs_verification',
   next:'Preparar procedimientos de reclamaciones, fallos, fraude y recuperación.'},
].map(item=>Object.freeze(item)));

export const LAUNCH_STAGE_LABELS = Object.freeze({
  built_demo:'Preparado en demostración',
  needs_verification:'Pendiente de verificación',
  external_required:'Requiere acuerdos, permisos o validación externa',
});

export function buildLaunchReadinessReport({countryCode=null}={}) {
  const country = typeof countryCode==='string' && /^[A-Z]{2}$/.test(countryCode)
    ? countryCode : null;
  const checks=LAUNCH_CHECKS;
  const count=(status)=>checks.filter(item=>item.stage===status).length;
  return Object.freeze({
    scopeCountry:country,
    checks,
    demoComponents:count('built_demo'),
    pendingVerification:count('needs_verification'),
    externalRequirements:count('external_required'),
    // No hay servicios financieros reales en la app; no confiar en datos del cliente
    // ni en estados de revisión para cambiar estos valores.
    readyForRealMoney:false,
    activeRealMoneyCountries:0,
    confirmedAuthorizedPayoutAgents:0,
    realPaymentsEnabled:false,
    status:'demo_only',
  });
}
