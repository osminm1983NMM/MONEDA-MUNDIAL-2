# MONEDA MUNDIAL — expediente de preparación antes de constituir la LLC
Fecha: 2026-10-15 · Estado: borrador técnico y de diligencia debida; NO habilita dinero real.

## Objetivo
Completar y probar una **aplicación de demostración** con arquitectura, seguridad y documentación suficiente para acudir posteriormente a profesionales financieros y regulatorios. Puede prepararse el producto antes de formar la LLC, pero ni el registro empresarial ni estas pruebas otorgan autorización para transmitir dinero.

## Entregables que podemos completar antes de la LLC
- Interfaz móvil, diseño, español/inglés automático, accesibilidad, recuperación de contraseña y orientación de usuarios.
- Billetera, aportaciones, transferencias, comercio, historial y recibos SOLO en créditos demo no convertibles.
- Catálogo mundial, simulador de tarifas sin inventar tipo de cambio, permisos por país deshabilitados de forma predeterminada.
- Pruebas automatizadas y de Android/Expo, seguridad de Supabase, consultas RLS, alertas, controles de concurrencia e idempotencia.
- Documentos de arquitectura y flujo de fondos **propuesto**, política de seguridad, privacidad, prevención del fraude y atención al cliente (borradores para revisión legal).
- Diseño de ledger de partida doble, conciliación, reversos y fondos de clientes para futura solución, sin confundir el ledger ficticio con dinero.
- Matriz de proveedores de procesamiento, bancos custodios y remesas, precios estimativos y criterios de selección.

## Información a presentar después ante bancos, licenciatarios y asesores
| Pregunta | Evidencia prevista |
|---|---|
| ¿Quién recibirá y custodiará el dinero real? | Diagrama y contrato de socio regulado/custodio. Aún pendiente. |
| ¿Qué entidad y propietarios se responsabilizan? | Documentos de la futura LLC, EIN, beneficiarios, responsables y solvencia. |
| ¿Qué licencias son necesarias? | Opinión legal por actividad, estado origen y corredor destino; no asumir exención. |
| ¿Cómo se verificará identidad y sanciones? | Políticas KYC/CIP aplicables, BSA/AML, OFAC y proveedores de validación. |
| ¿Cómo se evita fraude? | Límites, monitoreo, auditoría, investigación, reportes y respuesta a incidentes. |
| ¿Qué comisiones y tipos de cambio se cobran? | Fuente FX autorizada, divulgaciones, reglas de reembolso y costos. |
| ¿Cómo se evitan pérdidas y errores contables? | Libro mayor de doble entrada, custodia segregada, reconciliación y pruebas independientes. |
| ¿Cómo responderán reclamaciones? | Atención al cliente, reversos y gestión de errores conforme a las reglas aplicables. |

## Puertas para futuro servicio real (NO cumplidas)
1. Constituir entidad y documentación requerida; confirmar modelo con firma legal especializada.
2. Obtener licencias, autorizaciones, estatus de agente o acuerdos regulados que correspondan por estado y país. La LLC por sí sola no habilita remesas.
3. Contratar socios financieros regulados, custodio y proveedores de ingreso/desembolso.
4. Completar controles de cumplimiento, auditorías técnicas, riesgos, contabilidad y atención al usuario.
5. Ejecutar ensayos sandbox con proveedor, piloto autorizado limitado y publicación gradual en países aprobados.

## Riesgos actuales a cerrar
- Pruebas E2E entre dos usuarios de demo, reintentos, cargos repetidos, RLS, concurrencia y conexión intermitente.
- Revisar SECURITY DEFINER, acceso administradores, protección de contraseñas filtradas y recuperación.
- Mantener archivos de prueba, CI, documentación de costos y auditoría.
- Separar demo de futura producción; nunca reutilizar saldo ficticio en dinero real.
- Países del catálogo no representan aprobación regulatoria.
- La compilación Expo no reemplaza la prueba en un teléfono real.

## Propuesta de lanzamiento
Origen candidato: Estados Unidos. Destinos candidatos: Costa Rica y Honduras, sujetos a análisis jurídico, socios y licencias. Después se amplía por corredores autorizados. No prometer operar globalmente al inicio.

## Fuentes oficiales para revisión profesional
- FinCEN: https://www.fincen.gov/resources/money-services-business-msb-registration
- CFPB remesas: https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/remittance-transfer-rule/
- NMLS: https://mortgage.nationwidelicensingsystem.org/

**Conclusión:** preparamos el software y expediente antes de constituir la LLC, sin presentar preparación como autorización; dependencias de entidad y licencias se completan después.
