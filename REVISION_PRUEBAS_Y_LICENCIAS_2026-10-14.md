# Moneda Mundial 2.0 — revisión de pruebas y preparación de producción
**Fecha de revisión:** 14 de octubre de 2026  
**Estado:** SOLO DEMOSTRACIÓN. Prohibido procesar o anunciar transferencias de dinero real.

## 1. Comprobaciones reales efectuadas
Revisión de datos del proyecto Supabase conectado; se realizaron consultas de solo lectura, sin modificar saldos.

| Comprobación | Resultado |
|---|---|
| Billeteras ficticias registradas | 4 |
| Transferencias ficticias almacenadas | 3; 10,200 centavos MWD en total (102.00 MWD) |
| Aportaciones ficticias almacenadas | 2; 2,000 centavos MWD (20.00 MWD) |
| Reconstrucción de saldo cuenta a cuenta | 4/4 billeteras coinciden con saldo inicial + entradas - salidas |
| Diferencias entre saldos teóricos y saldos guardados | 0 |
| Grupos duplicados en actor_id + request_id | 0 |
| Total saldo en billeteras | 39,980.00 MWD ficticios |
| Restricción única por actor y request_id | Presente, mwd_unique_request |
| Actualización directa de saldos por usuarios autenticados | Denegada |
| Inserción directa de operaciones por usuarios autenticados | Denegada |
| RLS en tablas públicas | Activado |
| Compilación/validación Expo Android del diseño actualizado | GitHub Actions finalizó correctamente (commit dc000ab5677aa83efc53dbb9cac26d625d32be66) |

**Límite de la comprobación:** el historial y los saldos de estas cuatro cuentas concuerdan. Esto **no equivale** a una prueba automatizada completa del RPC con dos sesiones reales, de concurrencia, reversos, desconexiones o doble pulsación en Android.

## 2. Pantalla actualizada en rama de revisión
Archivo `App.js`:
- encabezado de marca MONEDA MUNDIAL;
- billetera principal con saldo e identificador;
- accesos directos Enviar / Recibir / Pagar / Actividad;
- panel con aportaciones, comercios, actualización y administración;
- tema financiero azul marino, turquesa y dorado;
- estado de carga en texto, sin `ActivityIndicator`;
- advertencia visible «MODO DEMOSTRACIÓN · SIN DINERO REAL».

No se ha eliminado la lógica existente de transferencia, cobros ni autenticación. Esta versión permanece en la rama `desarrollo-comercios-20261013` y su PR de revisión, no en producción.

## 3. Riesgos técnicos abiertos
- Ejecutar pruebas extremo a extremo desde dos usuarios de prueba autenticados, incluida recepción inmediata, reintentos con mismo UUID, rechazo de autopago, saldo insuficiente y concurrencia.
- Probar cobro ficticio comercio→cliente y cobros repetidos, expirados y cancelados; la solicitud existente en la base está todavía pendiente.
- Revisión externa de 5 funciones `SECURITY DEFINER` expuestas deliberadamente a autenticados por RPC (identifican actor mediante `auth.uid()`), con ensayos de acceso no autorizado, rate limit y pruebas de intrusión.
- Habilitar protección contra contraseñas filtradas en Supabase Auth. Requiere ajuste en consola, no está habilitado en la revisión.
- Las tablas del libro contable privado `mwd_finance_private` tienen RLS y no exponen directamente roles de cliente; su preparación no implica que actualmente soporten el saldo de billetera pública.
- **Aportaciones**: hoy descuentan créditos demo, sin abonarlos a cuenta beneficiaria de ledger de producción. NO utilizar ese diseño para dinero real. Implantar contabilidad de partida doble, conciliación, beneficiarios, recibos y reversos antes de operar.
- Backups, recuperación, auditoría, protección antifraude, observabilidad, análisis de dispositivos, segmentación de entornos, pruebas de carga y ensayos de incidentes.

## 4. Puertas legales y regulatorias (sin gestionar todavía)
Las siguientes etapas son trabajo de planificación, **no solicitudes ni aprobaciones de licencias**.

1. Definir empresa jurídica, jurisdicción inicial y modelo operativo: transmisor independiente vs. programa con banco/socio financiero autorizado. Una LLC por sí sola no autoriza envíos de dinero.
2. Dictamen jurídico sobre transmisión de dinero, custodia, aportaciones, pagos a comercios, saldo almacenado y estatus de MWD. No tratar un crédito de prueba como moneda con respaldo.
3. En EE. UU., determinar según hechos del negocio si aplica registro federal MSB con FinCEN y obligaciones BSA/AML. El registro no sustituye la autorización estatal, si aplica.
4. Revisar licencias estatales de transmisor de dinero y requisitos ante NMLS/reguladores de cada estado; capital, fianza y fondos admisibles.
5. Diseñar verificación de identidad/KYC, AML, prevención de fraude, sanciones OFAC, reportes, privacidad, conservación de evidencias y atención de reclamaciones.
6. Incorporar requisitos CFPB/Regulation E para remesas internacionales (información previa y posterior, tipo de cambio, costos, tiempo, cancelación y corrección de errores), cuando sean aplicables.
7. Contratar custodio de fondos y proveedores regulados, confirmar obligaciones de protección al consumidor y preparar auditoría.
8. Probar corredor de lanzamiento en sandbox certificado y obtener aprobación jurídica y de cumplimiento **antes** de activar cualquier operación real. Ampliar regiones por fases.

### Fuentes oficiales consultadas
- FinCEN: https://www.fincen.gov/resources/statutes-regulations/guidance/registration-and-de-registration-money-services-businesses
- NMLS / acuerdo de licencias MSB por múltiples estados: https://mortgage.nationwidelicensingsystem.org/knowledge/Products/nmls/stateresourcecenter/SitePages/MultistateMSBLicensingAgreementProgram.aspx
- CSBS — Money Transmission Modernization Act, actualizado septiembre 2026: https://www.csbs.org/csbs-money-transmission-modernization-act-mtma
- CFPB — Remittance Transfer Rule: https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/remittance-transfer-rule/
- OFAC — marco de cumplimiento de sanciones: https://ofac.treasury.gov/recent-actions/20190502_33

## 5. Siguiente criterio de salida
No cambiar el modo de la app a «real» hasta que existan: pruebas E2E verificadas, conciliación completa de doble entrada, contratos con socios bancarios y pagos, modelo jurídico documentado, licencias/registro exigidos y constancia de aprobación de cumplimiento.
