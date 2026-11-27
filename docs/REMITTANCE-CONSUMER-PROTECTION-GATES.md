# Protección del consumidor — requisitos de implementación y aceptación
Revisión pública 26 noviembre 2026. Alcance propuesto: primera remesa de consumo inmediata US/USD → Honduras, sin habilitar fondos. No determina la aplicabilidad jurídica ni la entidad obligada; asesoría y proveedor deben validar responsabilidades, excepciones, texto y plazos. No cubre pagos programados, activos digitales, otros corredores ni todas las obligaciones de Regulation E.

## Inventario verificado
- remittance-quote.js y RemittanceQuoteScreen.js: cotizador exclusivamente ficticio; valida importe, comisión y total en USD, rechaza FX extranjero no verificado, indica que no envía dinero. El selector banco/tarjeta representa origen, no método de entrega. No existe flujo de pago real en esta pantalla.
- financial-sandbox/postgres-refund-recovery-lab.sql y sus pruebas: controles de recuperación de reembolsos simulados, no acreditan cumplimiento de plazos o derechos de consumidor.
- docs/THUNES-ONBOARDING-GATES-20261126.md: integración y reparto contractual pendientes. Mantener ambas ramas de entrega en borrador. No modificar la APK candidata durante esta etapa.

## Matriz de desarrollo y aceptación
| ID | Requisito y propuesta de implementación | Evidencia exigida antes de activar |
| --- | --- | --- |
| C01 | Información previa al pago: monto, comisión, impuesto cuando corresponda, total, FX aplicable, cargos de terceros cubiertos y monto final en moneda destino; incluir avisos que correspondan. | Prueba de orden real sandbox contra valores de proveedor; revisión de formato y campos aplicables según 1005.31(b)(1). |
| C02 | Capturar versión inmutable de información previa y aceptación vinculada a la orden; si datos cambian antes de pagar, presentar información corregida y requerir nueva aceptación. | Carrera entre cambio de FX y aceptación; cotización anterior no genera un débito. |
| C03 | Recibo electrónico conservable: detalles, fecha de disponibilidad destino, destinatario, derechos, contacto de entidad obligada y datos regulatorios pertinentes; usar formularios CFPB aplicables como referencia. | Verificar texto, idioma, disponibilidad, accesibilidad, recuperación después de reinicio y vínculo con pago confirmado. |
| C04 | Plantillas aprobadas inglés/español, moneda y fechas inequívocas; conservar versión usada. | Comparación de traducción por especialista y pruebas en Android. |
| C05 | Cancelación: canal disponible para recibir solicitud oral o escrita, registrar recepción del proveedor/agente y evaluar plazo desde pago/autorización. | Pago inmediato: solicitud identificable dentro de 30 minutos, no cobrada ni depositada; prueba de frontera y carrera de entrega. |
| C06 | Si procede cancelar, devolver fondos y comisiones, más impuestos cuando sea legal, sin cargo adicional, dentro de tres días hábiles. | Reconciliar reembolso completo; duplicados no duplican pago; retraso genera alerta y caso, no borra obligación. |
| C07 | Abrir reclamación por canales admitidos y no depender del acceso a la app. Registrar referencia, recepción, descripción y comunicaciones. | Casos de entrega tardía, monto incorrecto, falta de entrega y solicitud de documentos. Revisar alcance de errores y excepciones según 1005.33. |
| C08 | Gestionar plazos: generalmente 180 días desde fecha de disponibilidad divulgada; excepción de documentación solicitada puede extender el plazo hasta 60 días después de envío cuando sea posterior. | Pruebas de frontera, extensión y escalamiento de caso dudoso; no rechazar automáticamente por reloj del teléfono. |
| C09 | Investigación pronta, máximo 90 días desde recepción; comunicar resultados dentro de tres días hábiles de concluir. Corrección según categoría y elección de remedio aplicable; no automatizar excepciones jurídicas. | Evidencia de decisión, notificación, remedio, reembolso/reentrega y reconciliación. |
| C10 | Conservar evidencia de cumplimiento por al menos dos años desde fecha de acción/divulgación requerida, y aplicar retención por investigación/procedimiento. | Política aprobada, bloqueo de borrado, acceso restringido, auditoría y restauración. |
| C11 | No confundir efectivo disponible con recibido ni solicitud de cancelación con cancelación confirmada. | Eventos auténticos del proveedor, reconciliación y estado visible al usuario; incertidumbre conserva obligación y requiere revisión. |
| C12 | Activación por corredor con responsable contractual, reglas y versión de plantillas, calendario y canales de atención comprobados. | Aprobación jurídica, contractual, de seguridad y del titular; aceptación oficial del proveedor. |

## Propuesta de interfaces y estado
- disclosure_record: order_reference, quote_reference, policy_version, locale, approved_template_version, monetary_fields, currency, displayed_at, accepted_at, evidence_reference. El servidor decide valores; la app no establece FX ni tarifas. Los importes se representan como enteros en unidad mínima y el FX con precisión decimal; presentación y cálculo separados. No aceptar estimaciones sin política autorizada.
- payment_receipt: order_reference, disclosure_reference, provider_reference, payment_at, disclosed_available_date, private_recipient_reference, template_version, delivery_evidence. Generar comprobante del pago, no evidencia de que el destinatario cobró.
- consumer_case: case_id, order_reference, intake_channel, received_at, case_type, policy_version, deadline_basis, status, assigned_role; eventos inmutables para decisiones, comunicaciones, evidencia y resolución. No pedir datos de tarjeta completos, contraseña, documentos sensibles o código de retiro en logs.
- cancellation lifecycle: received → eligibility_review → cancellation_requested_to_provider → confirmed_cancelled → refund_due → refund_confirmed → closed. También puede terminar en revisión de entrega previa o conflicto. No prometer reembolso hasta conocer resultado, ni cancelar por timeout. Capturar la hora de solicitud del consumidor; la latencia interna no reduce sus derechos.
- error lifecycle: received → investigating → determination → notice_due → remedy_pending → remedy_confirmed → closed; caso de no error requiere aviso correspondiente y acceso a documentos cuando proceda. Registrar alternativas y motivos de la decisión. Casos contradictorios pasan a revisión humana.
- deadlines: hora de servidor registrada en UTC y fechas civiles/calendario hábil de la entidad obligada versionados. El calendario y la zona se acuerdan; los días hábiles no equivalen necesariamente a lunes-viernes. No descontar feriados sin conocer definición aplicable. Alertas antes del vencimiento y escalamiento humano, sin alterar hechos históricos. No usar el reloj del dispositivo como autoridad.
- roles propuestos: atención registra; investigación revisa; operaciones ejecuta remedio autorizado; conciliación valida fondos; auditoría lee evidencia. Identidad autenticada, mínima autorización, segregación y no edición histórica. Asignación final depende de contrato y revisión.

## Pruebas de aceptación priorizadas
A. Cambio de precio justo antes de autorizar pago: exigir nueva divulgación; no crear orden pagada por aceptación vieja.
B. Diferentes cargos/impuestos/costos de terceros: coherencia USD y moneda destino sin sumarlos entre sí; recibo refleja lo aceptado y cobrado. No inventar cotización ni tratar el ejemplo DEMO como precio.
C. Cancelación recibida antes, en y después del límite de 30 min; distinguir hora de autorización de pago y recepción del agente. Considerar si fondos ya se entregaron; estado incierto requiere revisión.
D. Solicitudes repetidas por teléfono/app, callbacks duplicados y pérdida de respuesta tras reembolso: caso correlacionado, un solo efecto monetario, evidencia de recepción inicial preservada.
E. Pago acreditado al destinatario antes de cancelar, o confirmado después de solicitud: preservar cronología auténtica y revisión; no prometer reverso automático.
F. Queja en español sin acceso a cuenta, error de disponibilidad, falta de entrega o monto incorrecto: canal alternativo y seguimiento, plantilla y derechos correctos.
G. Días 180/90 y plazos de tres días hábiles con calendario aprobado, cambio de zona y extensión documental; nunca reiniciar plazos por reasignación de caso.
H. Restaurar historial con caso pendiente, fechas originales y devolución incierta; no crear segundo reembolso; retención/legal hold intactos.
I. Permisos: usuario A no puede acceder al recibo/caso B; operador sin permiso no ejecuta remedio; conciliación no altera diario; sin secretos en comprobantes públicos.
J. Prueba oficial por corredor y método de entrega; evidencias proveedor y UI concordantes. Todos los casos se marcan PENDIENTES hasta implementación y prueba efectiva; la CI financiera existente no los certifica.

## Fuentes y puntos de revisión
CFPB Regulation E vigente consultada el 26-11-2026:
- 12 CFR 1005.30: https://www.consumerfinance.gov/rules-policy/regulations/1005/30/
- 1005.31: https://www.consumerfinance.gov/rules-policy/regulations/1005/31/
- 1005.32 (estimaciones): https://www.consumerfinance.gov/rules-policy/regulations/1005/32/
- 1005.33: https://www.consumerfinance.gov/rules-policy/regulations/1005/33/
- 1005.34: https://www.consumerfinance.gov/rules-policy/regulations/1005/34/
- 1005.13(b): https://www.consumerfinance.gov/rules-policy/regulations/1005/13/
- Recursos y formularios: https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/remittance-transfer-rule/
Las referencias de plazos son requisitos generales sujetos a sus condiciones. Verificar excepciones, corrección de errores, cálculo de días hábiles, divulgación electrónica, publicidad, transferencias programadas, actos de agentes, normativa estatal, protección de datos, cumplimiento y responsabilidades con el proveedor y asesoría. Este documento no aprueba política comercial, no es certificación ni implementación y no habilita fondos. Siguiente hito: respuesta oficial del proveedor y validación física Android, no más fixtures para sustituirlos.


## Implementación inicial independiente de atención (laboratorio)
`financial-sandbox/consumer-case-lab.cjs` implementa un registro SQLite local de casos de cancelación, error e información, recepción por teléfono/escrito/app/agente, idioma, hora inicial, referencias opacas y máquina de estados. Permite registrar intake con orden aún no identificada; incertidumbre requiere investigación; un caso con remedio no se cierra hasta registrar aviso, observación y verificación separada. Los lotes son transaccionales y los replays exactos no alteran recepción; historial append-only, consulta filtrada por titular sin referencias internas y auditoría. Seis pruebas cubren estos controles, reapertura y dos conexiones. Es un prototipo de C05/C07/C09/C10/C11, no certificación ni cumplimiento completo: no calcula plazos legales, no vincula a una orden autenticada, no recibe llamadas, no envía avisos ni verifica referencias externas, no autoriza/ejecuta reembolsos ni cancelaciones. Actor, rol, reloj y dueño son fixtures suministrados por código de confianza, no autenticación ni control de acceso de producción. Faltan canales, identidad, permisos y políticas reales aprobados, conservación legal, almacenamiento seguro y revisión externa. No se altera Android ni producción.


## Inventario de vencimientos y alertas operativas (laboratorio)
`consumer-case-deadlines.cjs` calcula estados pendientes, próximos, vencidos, completados tarde/a tiempo y sin plazo definido a partir de historia íntegra y un calendario de vencimientos absolutos de fixture con referencia de política y fundamento. La decisión incierta no completa la investigación ni reinicia el vencimiento. Mantiene evidencia de retrasos aun tras cerrar el caso y no modifica el registro; `deadlineReview` lee la historia bajo una transacción. Seis pruebas cubren fronteras, ausencia de plazos, reapertura, incertidumbre, caso cerrado y entradas incompatibles. No calcula los plazos de Regulation E, días hábiles, extensiones ni elegibilidad; el instante exacto de vencimiento se trata como próximo, no vencido, solo como convención de prueba. Los planes se suministran en cada lectura y no se persisten ni autentican. No envía alertas automáticamente ni autoriza rechazos, cancelaciones o remedios. No cambia la APK, producción ni fondos. Requiere políticas, calendario, identidad y evidencias oficiales antes de implementar alertas reales.
