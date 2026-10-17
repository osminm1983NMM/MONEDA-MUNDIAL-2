# MONEDA MUNDIAL 2.0
## Expediente preliminar para alianzas con proveedores regulados
**Versión:** 17 de octubre de 2026  
**Clasificación:** ficha comercial inicial — no equivale a solicitud formal de licencia ni a contrato.  
**Estado jurídico del solicitante:** proyecto en etapa preconstitución; no afirmar LLC/EIN/licencia, cuenta bancaria empresarial ni socios contratados.

### 1. Resumen ejecutivo (para compartir)
**Nombre del proyecto:** Moneda Mundial 2.0  
**Categoría:** futura plataforma digital de remesas internacionales y servicios financieros, sujeta a aprobación.  
**Objetivo:** facilitar transferencias transfronterizas desde una interfaz móvil multilingüe, con información transparente sobre tarifas, cambio, importe neto y seguimiento.  
**Diferenciador solicitado:** recepción de efectivo por beneficiarios *sin teléfono ni app*, en puntos de pago autorizados, con verificación de identidad presencial y referencia de un solo uso validada por el proveedor.  
**Mercados objetivo:** origen inicial a **evaluar**: Estados Unidos (USD); primer destino a **evaluar**, no confirmado: Honduras (HNL o USD si la infraestructura lo admite). Nicaragua y los demás países permanecen en el catálogo mundial; cualquier expansión será por corredores aprobados a Centroamérica, Sudamérica y otros destinos.  
**Canales deseados, todos pendientes de verificación:** origen bancario y tarjetas compatibles; recepción en cuenta bancaria, billetera regulada o efectivo, según el país y socio.  
**Estado real del producto:** app de demostración y prototipos de seguridad, remesas y códigos de muestra en GitHub. No recibe, custodia, envía ni liquida dinero real; no cuenta con banco/operador integrado o contratado.  
**Monto y volumen de lanzamiento:** no determinados; se acordarán después de análisis de riesgos, costos, capital y límites del proveedor. No prometer volúmenes.

### 2. Flujo de la primera operación que queremos habilitar (futuro)
1. El remitente crea cuenta y pasa KYC/sanciones y límites aplicables.
2. El servidor consulta elegibilidad por corredor, método y moneda.
3. El proveedor autorizado emite una cotización con tarifa, FX, impuestos y neto a recibir.
4. El remitente acepta divulgaciones y financia la orden **mediante el proveedor autorizado**.
5. Tras confirmación verificable, el sistema contable registra la operación; la red de remesas transmite la instrucción.
6. Para depósito: el proveedor confirma abono a la cuenta del beneficiario.
7. Para efectivo sin app: el proveedor/agent verifica identidad y disponibilidad y realiza un pago único validado online. La app de Moneda Mundial no controla un cajero ni constituye prueba suficiente de pago.
8. El sistema recibe eventos verificables, concilia saldos, emite recibos y permite errores, cancelaciones y reembolsos conforme a reglas aplicables.

### 3. Estado técnico verificable
- **Existente:** interfaz React Native/Expo, Supabase para cuentas y saldos DEMO, protecciones de códigos de retiro ficticios, CI y un adaptador de proveedor **mock** en `src/server/mock-regulated-provider-bridge.mjs`.
- **No implementado:** integración real de una API bancaria, pasarela de fondeo, cuenta de fondos de clientes, KYC real, socios pagadores reales, webhooks externos, divisas con cotización válida, liquidación, reconciliación y libro mayor de producción.
- **Regla de seguridad:** jamás reutilizar `public.mwd_wallets` ni créditos MWD de prueba como dinero; secretos en backend autorizado, nunca en el teléfono ni GitHub.

### 4. Nuestro modelo a discutir (no decidido aún)
Solicitamos explorar un acuerdo donde **una o más entidades debidamente autorizadas** sean responsables, conforme a contratos y opinión legal, del fondeo/custodia/transmisión, FX, desembolso, reembolsos y obligaciones de cumplimiento. Debe quedar identificado el responsable de cada paso. No asumir que la licencia del proveedor cubre automáticamente a Moneda Mundial ni que una LLC basta.

### 5. Información que debemos preparar para incorporación/KYB
| Requisito | Estado hoy | Evidencia futura |
| --- | --- | --- |
| Constitución y país/estado de formación | PENDIENTE | Certificate of formation, registro |
| Identidad y propietarios beneficiarios | PENDIENTE | Documentación enviada sólo por canal seguro de KYB |
| EIN/identificador fiscal | PENDIENTE | Verificación fiscal |
| Dirección y correo corporativos | PENDIENTE | Contacto oficial |
| Cuenta bancaria empresarial | PENDIENTE | Constancia emitida por banco |
| Actividad, modelo de ingresos y proyecciones | BORRADOR | Plan financiero sin cifras inventadas |
| Alcance legal US y país destino | PENDIENTE | Dictamen legal por corredor y función |
| Políticas AML/KYC/OFAC y persona responsable | PENDIENTE | Documentos aprobados y proveedores contratados |
| Seguridad, privacidad, incidentes, continuidad | BORRADOR | Auditoría y pruebas independientes |
| Evidencia de cobertura/contrato del proveedor | PENDIENTE | Respuesta y contrato verificables |

**No colocar documentos de identidad ni credenciales de proveedores en el repositorio.**

### 6. RFI — preguntas de calificación obligatoria para todo proveedor
1. ¿Cuál es la **entidad legal** exacta que brindaría servicios en el origen EE. UU. y cuál recibe en Honduras? ¿Qué licencias/contratos aplica a cada parte?
2. ¿Permiten una fintech en **fase preconstitución** iniciar una conversación preliminar? ¿Qué se requiere antes de habilitar sandbox y antes de producción?
3. ¿Admiten específicamente **remesas P2P de EE. UU. a Honduras**? ¿Bancos, monedas, límites y disponibilidad reales por corredor?
4. ¿Ofrecen **retiro de efectivo presencial sin smartphone del beneficiario** en Honduras? ¿Cuántos agentes, identidad requerida, horarios, procedimiento y redención atómica?
5. ¿La referencia cobrable se emite en la red del proveedor? ¿Quién la verifica, revoca y anula? ¿Hay verificación online obligatoria y detección de doble pago?
6. ¿Qué métodos de cobro al remitente se permiten (ACH, débito, crédito)? ¿Cuál entidad acepta fondos y asume contracargos?
7. ¿Quién realiza KYC/CIP, KYB, AML/sanciones/PEP, monitoreo, reportes y pruebas de identidad del receptor? ¿Cómo se reparten las responsabilidades?
8. ¿Cuáles son los plazos de cancelación y errores, capacidad de reembolso/reverso, conciliación, settlement y soporte al consumidor?
9. ¿Tienen **sandbox oficial**, documentos OpenAPI, SDK, idempotencia, autenticación backend, webhooks firmados y exportaciones para conciliación?
10. ¿Cuáles son tarifas fijas y variables, FX/margen, prefunding, garantías, mínimos contractuales, reservas, SLA, penalizaciones y gastos de incorporación?
11. ¿Cuáles son políticas de privacidad, retención y residencia de datos, auditorías y responsabilidades ante fraude?
12. ¿Ofrecen cuenta digital/billetera regulada y pagos a tarjeta? Si no, ¿con qué socios e instrumentos puede interoperar la plataforma?

### 7. Criterios de decisión
**Rechazo automático para este piloto** si no se confirma por escrito: cobertura de origen/destino, naturaleza regulada y responsabilidades, esquema de fondos/reembolsos, controles AML/KYC y forma legalmente permitida de desembolso. Un sandbox disponible no equivale a aprobación comercial.

**Negociación posterior**, sólo si pasa ese filtro: cobertura para expansión regional, costos totales, documentación API, calidad de reconciliación, tiempo de pago, soporte y nivel de servicio.

### 8. Referencias técnicas públicas verificadas (no son contratos)
- Thunes, documentación de Money Transfer v2: https://docs.thunes.com/money-transfer/v2/ — menciona entornos de preproducción/producción y métodos de red, **no certifica US→HN para Moneda Mundial**.
- Nium, documentación de Payouts: https://docs.nium.com/docs/payouts — método cash pickup existe **en ciertos países**, no cobertura US→HN confirmada.
- TerraPay, contacto corporativo: https://www.terrapay.com/connect/ — candidato a evaluación, ningún servicio o corredor confirmado.
- EE. UU.: https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/remittance-transfer-rule/ ; https://www.fincen.gov/money-services-businesses-msbs

### 9. Acción comercial
Solicitar reunión de evaluación y respuestas RFI por sus canales empresariales oficiales. No registrar un negocio inexistente ni indicar falsamente licencias. Sólo remitir el expediente tras revisión por la persona responsable del proyecto. **No se ha enviado ninguna solicitud desde ChatGPT.**
