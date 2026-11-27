# Evaluación de incorporación Thunes — 26 noviembre 2026
Estado: revisión pública preliminar, sin contacto, contrato, credenciales, aprobación regulatoria, habilitación ni movimiento de dinero. Complementa la investigación del 17 de octubre, no repite sus comparativas.

## Hallazgos que cambian los requisitos
- Entidad: la tabla contractual pública identifica Thunes Financial Services, LLC para USA y declara registros/licencias. Su página de licencias incluye Maryland y NMLS 2450368. Es declaración del proveedor; falta confirmar registro vigente, entidad y alcance en NMLS y con el regulador. No inferir que la licencia se extiende al cliente B2B.
  Fuentes: https://www.thunes.com/legal-thunes-entity-table/ ; https://www.thunes.com/a-fully-compliant-and-regulated-network-usa/ ; https://www.dllr.state.md.us/FINANCE/industry/licsearch.shtml
- Maryland: el régimen de licencia contempla delegación autorizada; la ley requiere contrato expreso para tal nombramiento. Confirmar con asesoría si este modelo aplica al flujo concreto, nombre bajo el que se presta el servicio y demás responsabilidades estatales/federales. Comprar acceso API no prueba delegación.
  Fuentes: https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gfi&section=12-405 ; https://mgaleg.maryland.gov/mgawebsite/laws/StatuteText?article=gfi&section=12-413
- Términos regionales USA: contemplan colaboración del cliente empresarial en divulgaciones y recibos, identificación del proveedor, revisión de publicidad, informes de reclamaciones y reglas de datos. Describen cuentas agrupadas del proveedor separadas de sus recursos corporativos; no constituyen garantía de reserva propia de Digital ni custodia de Coin.
  Fuente: https://www.thunes.com/legal-usa-region-specific-terms/
- El proyecto contempla activos digitales: la lista pública restringe negocios de cripto/activos digitales y determinados agregadores, con autorización escrita específica y diligencia reforzada. No ocultar el alcance futuro al proveedor. Pedir aceptación explícita de la arquitectura y flujos separados; no suponer que autorización de remesas incluye cripto, ni usar fondos de remesas para respaldar/emisión de activos. No solicitar una excepción sin evaluación.
  Fuentes: https://www.thunes.com/legal-thunes-prohibited-and-restricted-list/ ; https://www.thunes.com/legal-thunes-terms/ ; https://www.thunes.com/legal-definitions/
- API pública v2: autenticación Basic con secretos de servidor; creación de cotización y operación separadas de confirmación; consulta por referencia externa ante incertidumbre; notificaciones y polling; estados de efectivo disponible distintos de pago completado. La documentación pública revisada no identifica Honduras mediante búsqueda textual; no demuestra ausencia de cobertura privada ni confirma el corredor. Exigir catálogo autenticado y respuesta escrita específica. Nunca tratar el código de cobro como evidencia de pago ni registrarlo en logs.
  Fuente: https://developers.thunes.com/money-transfer/v2/

## Matriz de habilitación del sandbox oficial
| Puerta | Evidencia necesaria antes de implementación habilitada | Estado |
|---|---|---|
| Contraparte y elegibilidad | Entidad contratante, registro vigente, estados de origen, caso C2C, condición pre-LLC o requisitos KYB | Pendiente |
| Flujo regulado | Acuerdo de responsabilidades y diagrama quién recibe, custodia, ejecuta, devuelve y atiende errores, revisión jurídica | Pendiente |
| Alcance Digital/Coin | Aprobación escrita del proveedor sobre negocio y flujos previstos; separar permisos y activos; modelo jurídico independiente | Pendiente |
| Corredor | USA/USD a HND, moneda destino y pagador/método aprobado, identificación presencial y posibilidad sin teléfono confirmada | Pendiente |
| Acceso de pruebas | Endpoint oficial no productivo, credencial de alcance mínimo en almacén privado, límites y datos ficticios autorizados | Pendiente |
| Seguridad | Contrato de autenticación de callbacks, verificación de fuente, replay, rotación, manejo de incertidumbre, pruebas de aislamiento | Pendiente |
| Liquidación | Estados, referencias, saldos/statement, corte completo, comisiones, FX, devoluciones y reglas de conciliación oficiales | Pendiente |
| Consumidor | Recibos y divulgaciones, reclamaciones, cancelaciones, revisión de publicidad y protección de datos según responsabilidades acordadas | Pendiente |
| Aceptación | Pruebas reproducibles de cada método en sandbox oficial, con evaluación independiente; producción aún deshabilitada | Pendiente |

## Solicitud complementaria al equipo comercial/compliance (borrador, no enviado)
Contact channel: https://www.thunes.com/contact/
Subject: Pre-onboarding eligibility and product-scope clarification — US to Honduras

We are evaluating a non-monetary demo for a future U.S.-origin consumer remittance service to Honduras. Our longer-term roadmap also includes distinct fiat and digital-asset products, with separate permissions, ledgers and reserves. No live funds or tokens are involved at this stage. We would like to disclose the planned product scope for your compliance review before any agreement.

Please clarify whether pre-incorporation technical discussions and a non-production sandbox are available; which contracting entity and regulatory/delegate model would be applicable; and whether the proposed future digital-asset activities require additional approvals or product separation. For the proposed U.S.–Honduras corridor, please confirm C2C availability, payout currencies and methods, including whether in-person cash pickup without a beneficiary smartphone is supported, and the corresponding test payer and identity requirements.

We also request your onboarding checklist and proposed responsibility allocation for customer disclosures, complaints, refunds, sanctions/KYC, safeguarded funds, transaction status authentication and settlement statements, and indicative costs. We are requesting information only, not a contract, account activation or production access.

## Decisión técnica
Mantener el laboratorio aprobado sin cambios funcionales. No implementar llamadas a endpoints no confirmados, no insertar credenciales ni datos personales en el repositorio, no activar servicios, no firmar ni aceptar términos. Obtener respuesta escrita y acceso autorizado antes de validar el sandbox oficial. Los hallazgos no constituyen asesoría jurídica ni aprobación de Thunes. Aceptación física Android continúa como puerta independiente.
