# Moneda Mundial 2.0 — candidatos técnicos para EE. UU. → Honduras
**Investigación pública: 19 de octubre de 2026 · estado: SOLO ESTUDIO, SIN CONTRATOS NI PAGOS**

No hay integración, claves de API, licencia, autorización, acuerdos ni prueba de disponibilidad de un corredor para Moneda Mundial. La información siguiente es material público de proveedores, **no una oferta ni acceso concedido**. Moneda Mundial sigue con `realPaymentsEnabled=false`.

## Candidatos investigados (documentación oficial)

| Candidato | Lo que acredita la fuente pública | Qué falta verificar antes de cualquier trabajo de integración |
|---|---|---|
| **Nium Payouts** | La documentación oficial describe entregas a bancos, tarjetas, billeteras y, según país, efectivo. Su Playbook de **Honduras** enumera SWIFT y Visa Direct en HNL; Visa Direct necesita aprobación adicional de Visa y la elegibilidad depende de país de origen, red e institución. | Confirmación de elegibilidad **de origen estadounidense → Honduras** para la entidad y caso de uso específicos; cobertura de bancos/tarjetas receptoras; contrato, sponsor, onboarding, sandbox, costos, SLA y cumplimiento. |
| **Thunes Money Transfer API v2** | Documenta preproducción, `GET /payers`, verificación opcional de beneficiario, creación de cotización, transacción, confirmación y consulta de estado; la disponibilidad de pagadores se descubre por API. | Validar en la cuenta contratada el pagador concreto de HN, métodos y moneda aceptados, fuente de fondos en EE. UU., tarifas, límites y condiciones; no inferir habilitación por la existencia de endpoints. |
| **TerraPay** | Sus documentos de API cubren operaciones B2B vía HTTPS, identificación del beneficiario y referencias únicas; las páginas oficiales incluyen Honduras y Nicaragua entre destinos de red. | Confirmación contractual y técnica del corredor US→HN/NI y método exacto, autorización de remitente y pagador, cumplimiento, pruebas, comisiones, autenticación, protección de datos y manejo de incidentes. |

Fuentes consultadas:
- Nium, Payouts: https://docs.nium.com/docs/payouts
- Nium, Honduras Playbook: https://playbook.nium.com/country/honduras
- Thunes, Money Transfer API v2: https://docs.thunes.com/money-transfer/v2/
- TerraPay, documentación de integración: https://developers.terrapay.com/docs/
- TerraPay, cobertura pública de red: https://www.terrapay.com/network/

**Regla de selección:** no dar por habilitado un destino solo porque aparezca en una lista de países. Se necesitan confirmaciones individuales para **país emisor, receptor, método de entrega, moneda, tipo de transacción, límites y entidad contratante**.

## Requisitos previos en Estados Unidos

1. Definir jurídicamente quién recibe, transmite, custodia o convierte fondos. La forma societaria LLC por sí sola **no es** licencia de transmisión de dinero.
2. Obtener evaluación legal regulatoria antes de solicitar acceso a producción. El registro FinCEN MSB, si corresponde, **no reemplaza** licencias estatales u obligaciones de AML/BSA; existen supuestos de operación como agente de entidades autorizadas que también deben verificarse con asesoría.
3. Comprobar las licencias o exenciones estatales pertinentes según lugar de actividad y alcance. **Si** Maryland es una jurisdicción operativa, revisar la licencia o figura de delegado autorizado con el regulador estatal.
4. Diseñar divulgaciones de tarifas, tipo de cambio, cantidad recibida, disponibilidad, cancelación, quejas y errores bajo la norma de remesas del CFPB cuando resulte aplicable. No codificar un plazo de cancelación universal sin revisar supuestos y excepciones.
5. Separar jurídicamente y en arquitectura los pagos internacionales de cualquier emisión o comercialización futura de Moneda Mundial Coin o Digital; esos productos requieren análisis regulatorio específico.

Fuentes regulatorias oficiales:
- FinCEN (registro MSB): https://www.fincen.gov/resources/money-services-business-msb-registration
- FinCEN (registro y licencias estatales, guía): https://www.fincen.gov/resources/statutes-regulations/guidance/interagency-interpretive-guidance-providing-banking
- Maryland (money transmitter, solo si aplica): https://www.dllr.state.md.us/finance/industry/moneytran.shtml
- CFPB remesas, derechos y errores: https://www.consumerfinance.gov/ask-cfpb/what-is-a-remittance-transfer-and-what-are-my-rights-en-1161/
- CFPB cancelación: https://www.consumerfinance.gov/rules-policy/regulations/1005/34/
- CFPB divulgaciones: https://www.consumerfinance.gov/rules-policy/regulations/1005/31/

## Orden propuesto de integración cuando exista entidad y convenio

**Etapa 0 (ahora).** Pantalla de planificación sin PII; lista de requisitos y pruebas DEMO; país y método no operativos; no cotizaciones ni transferencias reales.

**Etapa 1 (después de aprobación comercial/regulatoria).** Acceso *solo a sandbox de proveedor*, desde servidor, con variables secretas en gestor de secretos, nunca en APK, GitHub o Expo; separación de usuarios y logs redactados.

**Etapa 2.** Descubrimiento de corredores y métodos por cuenta de proveedor; esquema propio para traducir código ISO-2 del usuario a ISO-3 si el proveedor lo exige; verificar rol, jurisdicción, divisas, límites y campos permitidos.

**Etapa 3.** Flujo KYC/beneficiario administrado por el proveedor autorizado; no almacenar documentos en AsyncStorage. Cotización con expiración, comisiones, importe de recepción y avisos al consumidor, más opción clara para no continuar.

**Etapa 4.** Crear y confirmar operación con referencia idempotente generada en backend; estados `draft/quoted/confirmed/pending/paid/failed/cancelled/refunded` sujetos al contrato real, verificación criptográfica de webhooks, historial inmutable y conciliación contra reportes de liquidación.

**Etapa 5.** Revisión independiente de seguridad, protección al consumidor, gestión de disputas y ejercicio de reversos antes de habilitar un corredor específico de producción.

## Qué preguntar al equipo comercial de un proveedor

Solicitar confirmación **por escrito** de:
- ¿Aceptan una entidad en EE. UU. aún en proceso de constitución/licenciamiento o requieren patrocinio/licencia?
- ¿Soportan **P2P US→HN** y **US→NI** para cuenta, tarjeta, billetera y efectivo, por separado? ¿Origen estatal restringido?
- ¿Es posible cotizar USD→HNL con importe recibido y todas las tarifas; qué vigencia y precisión aplican?
- ¿Cómo verifican beneficiario sin exponer su identificación a la aplicación? ¿Qué tokens, KYC y plazos de conservación?
- ¿Qué tipo de idempotency key, callbacks, firma de eventos, reintentos, reconciliación, pruebas de sandbox y SLA exigen?
- ¿Qué responsabilidades regulatorias y de atención al consumidor asume cada parte? ¿Qué precios, mínimos, reservas y garantías aplican?

**Prohibido interpretar este documento como aprobación de proveedores.** No conectar pagos, no pedir claves ni datos financieros en la app, no crear saldos rescatables.
