# MONEDA MUNDIAL 2.0 — Plan multijurisdiccional, bancos y tarjetas

Fecha: 2026-10-14
Estado: **ESPECIFICACIÓN DE PRODUCTO; NO FUNCIONAL CON DINERO REAL**.
Decisión del fundador: la **prioridad regional es toda Centroamérica y Sudamérica**, con Estados Unidos como uno de los principales mercados de origen, no únicamente Ecuador. Diseñar desde el principio una app común multinacional; permitir, donde esté autorizado y soportado, financiar un envío desde una cuenta bancaria o tarjeta habilitada; recibir en una billetera regulada o directamente en cuenta bancaria; retirar desde billetera a banco o tarjeta elegible. Descarga gratuita y comisiones competitivas, transparentes y sostenibles. España, Turquía y otros mercados quedan dentro de la visión global posterior.

## 1. Conceptos que nunca deben confundirse

1. **Tarjeta de débito/crédito vinculada**: instrumento para autorizar un cargo (funding), y en ciertos mercados para un abono (push-to-card) a su cuenta vinculada. No equivale a acceso general, lectura o custodia del saldo de la cuenta bancaria. La tarjeta de crédito no implica que se puedan retirar fondos por remesa; requerirá habilitación explícita.
2. **Cuenta bancaria vinculada**: destino u origen de transferencias por redes bancarias respaldadas por proveedor autorizado. Titularidad, consentimiento y métodos de verificación.
3. **Billetera Moneda Mundial (saldo real futuro)**: únicamente si la opera una entidad autorizada para custodiar dinero electrónico o un socio responsable, con salvaguarda de fondos, conciliación y reembolsos. Debe identificar la entidad jurídica que custodia dinero. No debe convertirse automáticamente el saldo ficticio MWD en dinero real.
4. **Saldo bancario**: solamente se incrementa cuando la entidad receptora confirma el crédito en la cuenta. Vincular una tarjeta no significa que un saldo de la billetera se encuentre ya en el banco.

## 2. Flujo conceptual (ejemplo EE. UU. → Centroamérica o Sudamérica, y luego otras regiones)

a. Usuario remitente y destinatario se autentican; KYC, verificaciones de listas restrictivas, elegibilidad de corredor, límites, verificaciones de riesgo, beneficiario y titularidad.
b. Remitente elige destinatario y fuente: transferencia bancaria habilitada o tarjeta **elegible** tokenizada por proveedor PCI; nunca guardar PIN, CVV ni PAN completo en App.js, Supabase ni logs.
c. Servicio protegido en servidor calcula cotización con importe, costo de financiación, comisión propia, FX explícito cuando aplique, cargos, importe final a recibir y fecha estimada de disponibilidad. Requiere consentimiento.
d. Después de autorización/confirmación de fondos por procesador, ejecutar instrucción por operador autorizado y registrar estados reales: created, quoted, funding_pending, funded, compliance_hold, processing, settled, failed, reversed. **No marcar settled por haber iniciado una solicitud.**
e. Destinatario elige, **solo cuando está habilitado para su país/producto**: (i) acreditar saldo de billetera regulada; (ii) depósito directo a cuenta bancaria; (iii) desembolso a tarjeta de débito elegible mediante una red push-to-card. Para la opción (i) puede pedir más tarde un retiro a banco/tarjeta; requiere una transacción posterior y puede tener tarifa.
f. Servicio recibe notificaciones firmadas, verifica idempotencia, asienta partida doble, concilia contra estado del proveedor y envía comprobante. Reclamos, devoluciones, liquidación, plazos y soporte diferenciados por corredor.

## 3. Matriz de países (todos PENDIENTE de habilitación)

| País de destino o de operación | Moneda típica | Comprobar antes de cualquier activación |
|---|---|---|
| Estados Unidos (origen piloto) | USD | Elegibilidad de las instituciones, MSB/FinCEN y licencias estatales o estructura apropiada con un socio autorizado; disclosures y derechos de remesas según aplicabilidad |
| Ecuador | USD | Socio local habilitado; remesas y productos de billetera permitidos; payout bancario/tarjeta por banco participante |
| El Salvador | USD | BCR/SSF, proveedor/participante autorizado y reglas aplicables a dinero electrónico/remesas; verificar cobertura de tarjetas y bancos |
| Nicaragua | NIO, eventualmente cuentas en divisa | Banco Central de Nicaragua, proveedores autorizados de remesas y pagos; controles cambiarios, cumplimiento y conectividad bancarias |
| Turquía | TRY | Central Bank of the Republic of Türkiye, marco de pagos y dinero electrónico, socio autorizado, FX y cobertura bancaria/tarjeta |
| España | EUR | Banco de España, entidades autorizadas de pago/dinero electrónico, exigencias UE y operación transfronteriza y privacidad |

**Regla estricta:** autorización y conexión por país, ruta, producto, origen/destino, canal de financiación, moneda y beneficiario; nunca prometer cobertura global automática.

### Alcance geográfico aprobado por el fundador

**Región prioritaria en el diseño del producto (sin afirmar operatividad ni autorización):**
- **Centroamérica:** Belice, Guatemala, Honduras, El Salvador, Nicaragua, Costa Rica y Panamá.
- **Sudamérica:** Colombia, Venezuela, Guyana, Surinam, Ecuador, Perú, Bolivia, Brasil, Paraguay, Chile, Argentina y Uruguay. La Guayana Francesa requiere tratamiento normativo propio por su vinculación con Francia.
- **Origen principal a estudiar:** Estados Unidos. Un país puede actuar como origen y como destino cuando la regulación y la infraestructura lo permitan.
- **Ampliaciones globales:** México (Norteamérica), España, Turquía y otros mercados por fases posteriores.

**No es una lista de países habilitados.** Todas estas jurisdicciones quedan por evaluar respecto a socios, reglas, bancos, moneda, riesgos, licencias y restricciones locales. Los procedimientos y requisitos no son idénticos en todos los países.

### Estrategia de despliegue multirregional

1. Diseñar **una sola plataforma, multi-país desde el primer día de desarrollo**, con múltiples monedas, idiomas, rutas, destinos y medios de abono configurados desde servidor.
2. **Estudiar en paralelo** a socios bancarios y procesadores capaces de servir varias rutas entre EE. UU., Centroamérica y Sudamérica, para reducir trabajo contractual repetido cuando sea viable.
3. Crear una **matriz por corredor**: país origen/destino, moneda, método de fondeo, método de recepción, entidad ejecutora, licencias/opinión legal, KYB/KYC/AML, costos, límites, reversos, riesgos, pagos y conciliación.
4. Iniciar pruebas técnicas en entornos de simulación para **varios países simultáneamente**, aunque el primer movimiento de dinero real solo podrá ocurrir en rutas plenamente autorizadas y operativas.
5. Abrir rutas reales **por grupos según autorizaciones y contratos recibidos**; no limitar el plan comercial al primer país que pueda activarse. Países en revisión siguen deshabilitados para operaciones reales.
6. Definir las tarifas por corredor, forma de pago y moneda. No ofrecer comisiones inferiores al costo: el objetivo es mantener **margen de contribución positivo y rentabilidad sostenible** para Moneda Mundial, sin comisiones ocultas y de modo competitivo.
7. Para cada corredor definir el dinero final recibido, tiempo de entrega, riesgo de fraude y reversos, carga de soporte, tipo de cambio, impuestos y derechos del consumidor; y revaluarlo periódicamente.

**Ejemplo de política de disponibilidad:** Estados Unidos → Guatemala podría estar habilitado si todas las condiciones están satisfechas, mientras Estados Unidos → Perú puede seguir en revisión; ambas rutas aparecen como opciones informativas, pero la app no permitirá cursar dinero real por una ruta no habilitada.

## 4. Servicios de socios (contratación futura; ninguno conectado hoy)
- Procesador regulado de tarjeta con tokenización/PCI y flujos aceptados para financiar remesas; confirmación de elegibilidad y costos y reglas de contracargos.
- Banco o PSP regulado en EE. UU. para cuenta de liquidación, recaudación, conciliación y programa financiero compatible.
- Operador transfronterizo con trazabilidad de cotización, cambio de divisa cuando corresponda, pagos, estados y reembolsos.
- Proveedores regulados de cuentas, dinero electrónico, depósitos bancarios y push-to-card donde las redes lo admitan.
- Proveedor de identidad, KYC/KYB, sanciones, PEP, fraude y monitoreo.
- Soporte de reclamaciones, privacidad, fiscales y auditoría.
- Ninguna clave secreta, PAN completo, CVV, PIN, credencial bancaria ni información de fondos se guardará en repositorio público o cliente móvil.

## 5. Comisiones y transparencia
- Descarga gratuita. Por ruta cotizar todos los costos reales: proveedor, tarjeta o ACH, FX y margen cambiario, pago local, reembolsos, fraude, cumplimiento, impuestos y soporte.
- Mantener comisiones menores a competidores **comparables** únicamente cuando la operación no dé pérdidas.
- Mostrar costo total, moneda, tipo de cambio y monto neto a recibir antes de confirmar; evitar promesas de 'gratis' si hay cargos ocultos de FX/retiro.
- El dinero enviado y fondos en custodia son pasivos o saldos de clientes, NO ingresos de Moneda Mundial; únicamente comisiones debidamente devengadas serán ingresos de empresa.

## 6. Desacoplamiento y arquitectura de software
- UI: React Native muestra métodos disponibles y sus estados obtenidos del servidor, nunca decide precios ni cambia saldos por sí sola.
- API privada regulada (backend): perfiles de verificación, linked_instruments (solo ID tokenizado, cuatro últimos dígitos/alias), beneficiary_accounts, quotes, transfer_intents, transfer_events, fee_schedule por corredor, ledger de partida doble, payment_provider_reconciliation, audit_log inmutable, sanctions_reviews y chargeback/refund cases.
- Motor de disponibilidad por combinación país/moneda/canal y producto, desactivado por defecto; habilitación solo con revisión de operaciones, seguridad y abogado.
- Segregar por diseño: `public.mwd_wallets` y `public.mwd_operations` son 100% **demo**; prohibido reinterpretarlos como saldos, cuentas, fondos de clientes o liquidaciones reales.
- Diseñar adaptadores con APIs de sandbox y pruebas automáticas primero. Una simulación no implica que una conexión bancaria real esté activada.
- Revisar seguridad de pagos, RLS, PCI DSS, autenticación reforzada, consentimiento, PSD/AML, secretos backend, auditoría y protección de datos por región.

## 7. Prioridades y criterios de salida
1. Aprobar el alcance técnico **EE. UU. → Centroamérica y Sudamérica** y preparar en paralelo una matriz regulatoria y comercial de cada corredor. Elegir la primera ruta autorizada para una puesta en marcha controlada, sin reducir a ella el alcance del proyecto.
2. Obtener dictamen jurídico escrito y contratos del programa de pagos con entidades elegibles y autorizadas.
3. Crear simulador de flujos y comisiones con datos ficticios (no número de tarjeta real).
4. Probar rechazos, reintentos, duplicados, idempotencia, concilios, devoluciones, chargebacks, fraudes, interrupciones y fondos insuficientes.
5. Activar medios de ingreso y retiro solo después de contratación, revisión técnica y autorizaciones regulatorias aplicables; registrar y auditar activación país a país.
6. No almacenar ni procesar detalles completos de tarjetas en Supabase/React Native; utilizar SDK/tokenización de proveedor certificado.

## 8. Referencias técnicas y regulatorias (verificar las versiones vigentes antes de operar)
- CFPB remittance transfer disclosures: https://www.consumerfinance.gov/rules-policy/regulations/1005/31/
- FinCEN MSB registration and state licenses: https://www.fincen.gov/resources/statutes-regulations/guidance/registration-and-de-registration-money-services-businesses
- Visa Direct para tarjeta: https://developer.visa.com/docs/visa_direct
- Visa Direct a cuenta/billetera según región: https://developer.visa.com/docs/visa-direct-account-and-wallet
- Banco de España autorizaciones: https://www.bde.es/wbe/es/punto-informacion/contenidos/autorizaciones-acreditaciones/autorizacion-inicio-actividad/
- Central Bank Republic of Türkiye, instituciones de dinero electrónico: https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB%20EN/Main%20Menu/Core%20Functions/Payment%20Services/Electronic%20Money%20Institutions
- Banco Central de Nicaragua — vigilancia financiera: https://www.bcn.gob.ni/vigilancia-financiera
- BCR El Salvador — dinero electrónico e inclusión financiera: https://redibacen.bcr.gob.sv/conferencia.php?cod=363
- PCI SSC: https://www.pcisecuritystandards.org/standards/pci-dss/

**Importante: Este archivo no constituye autorización financiera, compromiso de socios bancarios ni afirmación de que algún corredor esté habilitado.**
