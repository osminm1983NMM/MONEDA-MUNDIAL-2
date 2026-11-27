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


## Aclaración de alcance de stablecoins — 26 noviembre
La oferta pública Pay-to-Stablecoin-Wallets se refiere a pagos USDC/USDT mediante un socio licenciado, con disponibilidad por jurisdicción. El anuncio del 19 de octubre de 2026 de colaboración Thunes/Coinbase describe infraestructura de stablecoins y alcance fiat de última milla. No demuestra aceptación de tokens propios, emisión, custodia, reservas, listado ni disponibilidad para Moneda Mundial. La lista de categorías restringidas exige aprobación específica escrita y diligencia reforzada para negocios de activos digitales. Mantener las tres puertas independientes: remesas fiat, eventual integración con activos de terceros expresamente aprobados, y eventual emisión/operación de Digital y Coin propios. No sustituir Digital por USDC/USDT ni seleccionar Coinbase como custodio sin aprobación. En la consulta comercial pedir confirmación explícita de activos/redes permitidos, entidad y socio ejecutor, jurisdicciones, modalidad de custodia, reembolsos, tarifas, y si admiten tokens propios o exclusivamente activos de terceros. No incorporar activos adicionales ni asumir que la colaboración comercial está disponible para nuestro caso.
Fuentes oficiales: https://www.thunes.com/solutions/pay-to-stablecoin-wallets/ ; https://www.thunes.com/news/thunes-and-coinbase-join-forces-to-drive-next-generation-global-payments ; https://www.thunes.com/legal-thunes-prohibited-and-restricted-list/ . La página pública de licencias también confirma que Thunes declara Maryland y NMLS 2450368; no es verificación independiente del regulador. El siguiente hito es respuesta escrita, no otra simulación.


## Identidad regulatoria en canales digitales — puerta de aceptación Maryland
Revisión del texto legislativo oficial, Financial Institutions §12-410(e),(f), el 26-11-2026: https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gfi&enactments=false&section=12-410 . La licencia no es transferible. Para el licenciatario, la disposición (f)(3) exige que la identificación NMLS, enlace a Consumer Access y aviso de contacto del regulador estén visibles en los canales digitales aplicables (incluidas aplicaciones móviles y perfiles sociales). La disposición (f)(2) contempla avisos en ubicaciones públicas de delegados. La asesoría y contraparte deben determinar qué avisos y canales corresponden al modelo de Moneda Mundial y aprobar texto, contacto, identidad contractual y presentación antes de activar el corredor. No atribuir licencia propia ni mostrar NMLS de Thunes como si fuera de Moneda Mundial.

Verificación de licencia: la oficina estatal dirige a NMLS Consumer Access: https://labor.md.gov/finance/industry/licsearch.shtml . Se intentó consultar directamente https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/2450368 sin acceso al registro. La declaración del proveedor https://www.thunes.com/a-fully-compliant-and-regulated-network-usa/ no sustituye verificación independiente de vigencia, condiciones ni autorización contractual en Maryland.

### Entrega y prueba de interfaz, tras validación contractual
- Obtener identidad del operador licenciado, NMLS verificado, aviso y datos de contacto aprobados, versión y fecha de revisión, ámbito de corredor/estado y canales aplicables.
- Diseñar la ficha de identidad legal como contenido versionado de servidor, sin edición por usuarios ni textos simulados que aparenten licencia; si falta aprobación, la ruta de dinero real permanece deshabilitada. No alterar la APK LAB actual.
- Aceptación: revisar en Android y web la visibilidad, contraste, accesibilidad, idioma aprobado, enlace oficial, titular correcto y consistencia con recibo/publicidad; revisar perfiles sociales y otros canales aplicables. Capturar evidencia por versión sin datos personales. Comprobar ausencia de datos de licencia falsos en modo DEMO.
- Solicitar al proveedor confirmación escrita del reparto de responsabilidades y copia de los avisos aprobados junto con su lista de incorporación. Este requisito es independiente de la certificación técnica y no supone que Thunes haya aceptado el proyecto.


## Evaluación formal autorizada — 27 noviembre 2026

El titular autorizó la evaluación informativa de Thunes; no contratación, apertura de cuenta, gastos, despliegue ni fondos reales. Hallazgo material: el catálogo público actual https://www.thunes.com/direct-global-network/ enumera Honduras con cuentas bancarias, sin listar efectivo ni billetera móvil para ese país, aunque sí lista esos métodos para otros destinos. Esto permite considerar depósito bancario como candidato, no confirma corredor US→HN para nuestra entidad, moneda HNL, pagadores ni disponibilidad contractual. No asumir efectivo disponible. Solicitar confirmación escrita; si no existe, evaluar otro proveedor para retiro presencial y conservar separación de métodos.

La documentación Money Transfer v2 https://docs.thunes.com/money-transfer/v2/ establece entornos producción/preproducción, detalles de endpoints entregados al crear cuenta, HTTPS TLS >=1.2 y autenticación de API. No seleccionar hostname por inferencia. El portal Business Hub permite a socios consultar corredores, tarifas y FX, efectuar pruebas sandbox y gestionar credenciales/IP autorizadas: https://thunes.zendesk.com/hc/en-us/articles/17605963612957--Starter-Guide-What-can-I-do-with-Thunes-Business-Hub . Incorporación incluye perfil empresarial y diligencia: https://thunes.zendesk.com/hc/en-us/articles/17625845152029-What-is-Thunes-Onboarding . Las actividades de activos digitales siguen sujetas a autorización específica escrita: https://www.thunes.com/legal-thunes-prohibited-and-restricted-list/ .

Canal comercial oficial https://www.thunes.com/contact/ requiere nombre, apellido, correo empresarial, nombre de compañía, país y motivo de consulta. No se ha enviado formulario ni contactado a Thunes. No inventar identidad jurídica o correo; el borrador de consulta anterior permanece listo para el titular. Solicitar expresamente depósito bancario HNL, disponibilidad de retiro presencial y alternativas, elegibilidad pre-LLC, modelo regulado, costes fijos/mínimos y por operación, acceso preproducción, catálogo autenticado y alcance separado de activos digitales. No publicar credenciales ni información personal en GitHub. No implementar llamadas remotas hasta recibir documentación y acceso autorizados.


## Solicitud comercial enviada — 27 noviembre 2026
El titular completó el registro del dominio empresarial, verificó su contacto y comprobó envío/recepción de correo. La pantalla oficial de Thunes confirmó recepción del formulario de contacto. No constituye aprobación de la contraparte, disponibilidad del corredor, contrato ni credenciales de sandbox. Próxima puerta: respuesta escrita, revisar bandeja de entrada y spam el 30 de noviembre; no reenviar solicitud duplicada ni habilitar dinero real. Sin publicar datos personales, credenciales o enlaces de activación.
