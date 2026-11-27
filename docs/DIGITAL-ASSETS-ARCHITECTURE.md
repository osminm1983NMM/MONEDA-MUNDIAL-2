# Moneda Mundial — arquitectura de activos digitales (propuesta para revisión)
Estado: diseño técnico previo a implementación; 26 de noviembre de 2026.
No es autorización de emisión, oferta, custodia, conversión real, contrato, clasificación jurídica ni decisión de red. No desplegar. No cambiar Android DEMO, main, ni base compartida.

## 1. Separación de productos y patrimonio
| Producto | Naturaleza prevista | Regla de separación |
| --- | --- | --- |
| MWD DEMO | Crédito ficticio de pruebas | No convertible a activos reales, no migrar saldos a producción ni reconocerlos como pasivos USD. |
| Moneda Mundial Digital | Activo que aspira a mantener paridad 1:1 con USD | Emisión/redención y reservas elegibles sujetas a aprobación; paridad objetivo no garantiza precio de mercado ni redención inmediata. |
| Moneda Mundial Coin | Activo con precio variable | Diario de unidades independiente. No prometer retorno, precio fijo, reservas USD ni convertibilidad ilimitada. |
| Remesas fiat | Obligación de financiar y entregar por corredor autorizado | No usar fondos de clientes de remesas como respaldo de Digital, inventario de Coin ni financiación operativa. |
Los identificadores definitivos, decimales, blockchain, red, suministro, precio inicial, reglas de transferibilidad y modelo de custodia están pendientes. No crear contratos inteligentes ni claves hasta resolverlos. Los identificadores de producto son internos, no símbolos comerciales registrados.

## 2. Arquitectura y límites de confianza
- Aplicación móvil: muestra cotizaciones, saldos disponibles/reservados y estados; nunca decide precio, crédito, emisión, transferencia final ni autorización. Las claves privadas de custodia no se distribuyen con la app.
- Servicio de identidad y riesgo: actor derivado de sesión autenticada; elegibilidad, beneficiario, límites, detección de abuso y revisión humana de operaciones. No aceptar parámetros de identidad o veredictos de riesgo del cliente como autoridad.
- Servicio de cotización: precio, origen, instante, caducidad, cantidad, comisión y deslizamiento máximo explícitos; conversiones consumen cotizaciones una sola vez. Si no hay precio válido o liquidez, no operar.
- Motor de órdenes: idempotencia por actor/operación/solicitud, reserva transaccional, diario inmutable de doble partida, outbox e inbox deduplicados. No usar una transferencia de la DEMO como orden real.
- Adaptadores de custodia, banco, proveedor de precios y red: segregados; autorizaciones y verificación de eventos específicos del contrato. La identidad de firmante y controles de retiros requieren diseño del modelo de custodia aprobado.
- Servicio de conciliación independiente: compara submayor, custodia/red, saldos de reserva y movimientos bancarios con ventanas y evidencia verificables. Sin credenciales de escritura en el diario.
- Estado inicial de todos los productos reales: deshabilitados. Cada producto tiene barreras independientes; activar remesas no activa Digital/Coin y viceversa.

## 3. Modelo de datos propuesto
asset_registry: asset_id, environment, precision, lifecycle, policy_version; registro inmutable por versión.
accounts: account_id, legal_entity, asset_id, category, owner_reference; identificar fondos propios vs clientes; datos personales fuera del diario.
orders: order_id, actor_reference, kind, request_id, request_fingerprint, policy_version, quote_id, state, created_at.
postings: journal_id, account_id, asset_id, signed_minor; exactitud de enteros, ningún float; signo positivo débito/negativo crédito. Aprobación contable define plan de cuentas, no reutilizar cuentas de MWD ficticio.
external_events: source, event_id, digest, reference, finality, observed_at, received_at; vínculo único a aplicación contable.
reserve_snapshots: cut_id, eligible_assets_minor, outstanding_digital_minor, restrictions, evidence_refs, verification_status. Evidencia de titularidad, disponibilidad y ausencia de doble conteo; no aceptar una cifra declarada por el usuario.
quotes: quote_id, input_asset, output_asset, amounts_minor, fee_asset, fee_minor, price_source, valid_until, policy_version; inmutable.
Incidentes, revisiones y autorizaciones: referencias al evento/orden; identidad autenticada de revisores distintos, motivo y evidencia. Evitar incorporar secretos, llaves, documentos de identidad o códigos de cobro a logs.

## 4. Invariantes previos al diseño del esquema
1. Cada asiento se equilibra dentro de cada activo. Nunca sumar centavos USD y unidades Coin como si fueran equivalentes. La valoración contable en USD es un proceso separado sujeto a política.
2. No gastar unidades reservadas, bloqueadas, pendientes de confirmación o en otra cuenta. Reservas y débitos deben serializarse, incluidos procesos concurrentes.
3. Cada efecto externo se aplica una sola vez; misma solicitud y misma huella devuelve el mismo resultado; reutilización con otra huella se rechaza.
4. El suministro emitido, las unidades en custodia, en circulación y pendientes se concilian según el modelo de red elegido. No contar dos veces una unidad en tránsito.
5. Para Digital, política propuesta de cobertura mínima: valor elegible disponible en USD >= obligaciones Digital redimibles en USD, sin contar fondos de remesas, Coin, garantías ya comprometidas ni activos sin confirmación. Incluir obligaciones de redención pendientes según política contable; no reducirlas solo por una petición del cliente. Falta definir elegibilidad, valoración, horizonte de liquidez, titularidad y procedimiento ante déficit. No afirmar respaldo efectivo sin evidencia.
6. Si falta evidencia, hay discrepancias de suministro/reservas, precios caducados, custodia incierta o eventos contradictorios: bloquear nuevas operaciones que aumenten exposición y escalar; las redenciones/devoluciones y obligaciones existentes requieren procedimiento autorizado, no cancelación automática.
7. Nunca liberar una reserva por timeout si la operación externa pudo ejecutarse. Consultar estado, conciliar y mantener obligación hasta resolución definitiva.
8. Los ajustes contables son asientos compensatorios aprobados y trazables, nunca edición ni borrado de eventos históricos.

## 5. Ciclos de vida a implementar tras aprobación
| Flujo | Secuencia de referencia | Regla de fallo |
| --- | --- | --- |
| Emisión Digital | solicitud → identidad/controles → fondos elegibles confirmados → autorización → emisión confirmada → disponible | No acreditar antes de confirmar; reconciliar emisión incierta. |
| Redención Digital | solicitud → reserva de unidades → autorización → retirada de circulación confirmada → pago USD confirmado → cierre | Conservar obligación de pago hasta confirmación; no restaurar unidades automáticamente tras respuesta ambigua. |
| Compra/venta Coin | cotización válida → reserva → orden → ejecución externa o interna autorizada → conciliación → entrega | No inventar precio ni liquidez. Política para ejecución parcial, expiración y deslizamiento. |
| Conversión Digital/Coin | cotización → reservar entrada → ejecución única → contabilización por ambos activos → liberar resultado disponible | Si los dos tramos no son atómicos, persistir exposición intermedia, recuperar y conciliar; no declarar éxito por un solo tramo. |
| Transferencia externa | reserva → validación destino/red → revisión → firma autorizada → difusión → confirmación/finalidad → cierre | Red equivocada, reorganización o respuesta incierta se escalan sin segundo envío automático. |
El orden exacto de emisión/redención y las cuentas de compensación dependen del contrato, custodia, red y revisión contable. No afirmar atomicidad entre una cadena y un banco.

## 6. Plan de aceptación técnica
- Contabilidad: comprobar balances por activo, conservación del suministro, fondos restringidos, cobertura, conciliación con fuentes independientes, diferencias y reversos.
- Concurrencia: dos débitos sobre saldo único, consumo simultáneo de cotización, reservas duplicadas, doble emisión y reintentos.
- Recuperación: pérdida de respuesta después de ejecución externa, reinicios, restauración independiente, duplicación y eventos fuera de orden.
- Precios: decimales exactos, unidades máximas, precio ausente/caducado, comisión incorrecta, ejecución parcial y discrepancia.
- Seguridad: permisos por servicio, separación de revisores, custodia y rotación de claves, recuperación de acceso y protección de datos; pruebas independientes antes de cualquier lanzamiento.
- Casos externos: simular y posteriormente verificar en el entorno oficial de cada proveedor/cadena, con datos de prueba; no usar fondos de clientes ni publicar contratos reales.
- Lanzamiento: aprobación independiente legal, financiera, de seguridad y del titular del proyecto, activación gradual por producto y corredor, monitoreo y procedimientos de incidente y restitución.

## 7. Decisiones pendientes y dependencia del siguiente paso
- Titular del proyecto y asesoría especializada: alcance inicial, jurisdicción, estructura de entidad, términos y derechos de tenedores, política de emisión/redención, disponibilidad por país.
- Especialistas financiero/contable: elegibilidad y segregación de reservas, liquidez, plan de cuentas, obligaciones, tratamiento de comisiones/costos y conciliación.
- Arquitectura y seguridad: custodia propia o proveedor especializado, red/activo nativo o registro interno, autoridad de emisión, límites, precisiones y finalidades, evaluación de proveedores y amenaza.
- Titular y especialistas: política de oferta y distribución de Coin; suministro y precio no quedan aprobados por este documento.
- Implementación técnica solo después de fijar esas dependencias: esquema privado y motor de órdenes, pruebas de invariantes, adaptadores oficiales, revisión independiente. No se selecciona red, custodio ni proveedor y no se crea token por este documento.


## Primer prototipo ejecutable — cobertura Digital ficticia
`financial-sandbox/digital-reserve-projection.cjs` proyecta hasta 10.000 eventos sintéticos en memoria, usando enteros BigInt y una unidad mínima Digital de prueba igual a un centavo USD ficticio. Modela entradas de reserva, pérdida, emisión, reserva de unidades, cancelación previa a quema, quema y pago confirmado de redención. La quema sustituye la obligación Digital por una obligación USD pendiente sin liberar cobertura; la confirmación del pago reduce efectivo y obligación. La emisión se rechaza cuando aumentaría un déficit. Coin, remesas y efectivo operativo no se admiten como fuentes de cobertura en el fixture. El diario se equilibra por activo, conserva saldos y deduplica eventos. Seis pruebas cubren estados, segregación, exactitud, déficit, doble gasto y repetición. No es motor transaccional, no acredita titularidad ni autenticidad de eventos, no prueba segregación real, no tiene cotización, custodia, cadena ni reglas Coin implementadas. El origen de fondos y el plan de cuentas de compensación son ejemplos sujetos a revisión. No se importa en Android ni se conecta a proveedores o producción. No usar como autorización de emisión o de redención.


## Prototipo independiente de unidades Coin
`financial-sandbox/coin-unit-projection.cjs` modela un diario ficticio de unidades `COIN_TEST` con emisión a tesorería, reserva y confirmación/cancelación de transferencias internas y quema de unidades disponibles. El tope de emisión histórica es un parámetro explícito del fixture (no se recicla capacidad por quema); no es una decisión de tokenómica ni de suministro comercial. La circulación fuera de tesorería se reporta como unidades no pertenecientes a tesorería, no como free float de mercado. Conserva suministro, reservas por titular y diario balanceado por activo con BigInt; seis pruebas comprueban límite, doble gasto, replays, separación de Digital y exactitud. No hay precio, cotización, conversión, liquidez, custodia, confirmación de red, identidad de usuario, autorización de emisión ni persistencia/concurrencia. Solo eventos de prueba ya dados por confirmados. No se emite ningún activo real ni se selecciona blockchain. Los límites y la precisión definitiva requieren aprobación.


## Conversiones internas Digital/Coin — proyección conjunta
Se añade reserva, confirmación y cancelación de transferencias internas al diario Digital. `digital-coin-swap-projection.cjs` une ambos diarios existentes por cotización ficticia explícita con cantidades enteras, titular, dirección, expiración y consumo único. Reserva inventario de las dos partes (usuario y tesorería) antes de transferir; una historia inválida de cualquiera de los activos impide devolver un resultado de la proyección. La conversión no cambia suministro, cobertura o efectivo USD ni usa fondos de remesas. Seis pruebas comprueban ambas direcciones, inventario insuficiente, reservas competidoras, expiración, titular, repetición, cancelación y déficit. La comisión es cero exclusivamente en este fixture; los tiempos y precios se suministran como datos de prueba. El módulo no tiene persistencia, identidad autenticada, mercado, ejecución parcial, fuente de precio, motor transaccional ni integración bancaria o de cadena; la atomicidad de esta proyección pura no demuestra atomicidad de escritura real. No activar en Android o producción.


## Persistencia conjunta de conversiones (SQLite desechable)
`financial-sandbox/digital-coin-ledger.cjs` conserva inventario inicial ficticio y un único historial de conversiones append-only. Valida el historial y ambos diarios derivados bajo BEGIN IMMEDIATE antes de insertar cualquier evento; un lote inválido revierte entero. WAL, synchronous FULL, secuencias y unicidad de identificador, comparación de payload para reintentos y reapertura. Dos conexiones comprueban visibilidad de reservas y rechazo de sobregiro secuencial. Cinco pruebas nuevas incluyen recuperación, rollback, duplicados, conflicto y semilla inmutable. No son dos diarios materiales persistidos: los saldos se reconstruyen desde un historial común. No demuestra concurrencia multiproceso real, recuperación ante pérdida física, autenticación, precio, custodia, transacciones externas, ni resistencia frente a administrador que modifica archivos/esquema. Semilla y tiempos son fixtures confiables; límite local de 2000 eventos y lotes de 100. No se conecta con Android, Supabase, redes ni fondos reales.


## Concurrencia multiproceso y recuperación ante pérdida de respuesta (laboratorio)
Tres pruebas nuevas en `tests/financial/digital-coin-ledger-process.test.cjs` utilizan procesos Node independientes y una base SQLite temporal: carrera de dos conversiones por el mismo saldo con una sola reserva válida; salida deliberada después del commit sin devolver el resultado y recuperación idempotente; e inyección directa de un INSERT sin commit seguida de salida abrupta para verificar rollback. No se altera el código del motor ni se amplía acceso a producción. La última prueba es de rollback de SQLite, no una interrupción instrumental del API. No demuestra tolerancia a pérdida física del disco, recuperación distribuida, ni concurrencia en PostgreSQL de un servicio real. Resultados sujetos a CI.


## Respaldo verificable del historial conjunto
El ledger SQLite añade `manifest`, `backup` y `verifyDigitalCoinBackup`: manifiesto lógico SHA-256 del inventario inicial y eventos ordenados, conteo, cobertura y suministro recalculados; VACUUM INTO exclusivo, fsync del archivo, inspección de solo lectura y comparación con ancla independiente. Debe hacerse con escritores pausados; si el snapshot contiene un cambio posterior al manifiesto, la verificación rechaza la copia. Tres pruebas comprueban restauración de reserva tras retirar el origen, continuación y replay, truncamiento lógico y rechazo de sobrescritura. No valida privilegios o esquema íntegro, no protege de sustitución simultánea de manifiesto y copia, no es respaldo externo ni garantía frente a pérdida física; no sincroniza directorio ni define RPO/RTO. Requiere almacenamiento privado confiable. Solo laboratorio, no modifica Android ni producción.


## Conciliación independiente de reservas y custodia (laboratorio)
El ledger expone `reconciliationSnapshot` con manifiesto y proyección obtenidos en la misma transacción de lectura. `digital-coin-reconciliation.cjs` compara tres informes sintéticos independientes (reserva USD elegible, subregistro de custodia Digital y Coin) para un mismo corte completo. Contrasta obligaciones incluyendo redenciones pendientes, suministro declarado, suma de posiciones y saldo total por titular (disponible + reservado). Detecta déficit incluso si coincide el saldo contable, diferencias de titular aun con suministro agregado igual, referencias faltantes y montos incompatibles. Cinco pruebas con informes escritos independientemente de la salida del ledger. La etiqueta de fuente/corte es declarativa, no prueba autenticidad, titularidad ni elegibilidad real; el llamador debe congelar el corte, mantener anclas independientes y verificar origen. No compara un blockchain público con propietarios internos, no acredita disponibilidad por titular, no autoriza emisión, conversión o pago. No integra proveedor, red, Android ni producción.


## Barrera transaccional de conciliación (modo opt-in de laboratorio)
Al inicializar una base nueva con `requireReconciliation:true`, el modo durable `synthetic-digital-coin-gated-v1` exige a cada lote con eventos nuevos un corte limpio comparado con el estado previo exacto dentro de BEGIN IMMEDIATE. El manifiesto SHA-256 suministrado debe coincidir con el historial vigente; la comparación se recalcula, no acepta un booleano de confianza. Replays sin efectos nuevos no requieren otro corte. El modo no puede cambiar al reabrir y forma parte de la huella de respaldo. Dos pruebas integradas cubren discrepancia, corte incompleto, concurrencia entre conexiones, reapertura, respaldo, replay y modo previo. Las bases v1 existentes siguen sin barrera para fixtures anteriores; no hay migración automática. Se bloquean todos los nuevos eventos de conversión (incluidas cancelaciones) en modo gated cuando falta evidencia; es una regla conservadora de laboratorio, no política de resolución de obligaciones reales. Los informes no se archivan por este método ni se autentican; no se garantiza actualidad temporal de fuentes externas ni que los datos sean independientes. Requiere adquisición y retención oficiales, identidad, permisos y diseño de incidentes antes de producción. Sin red, emisión real, Android ni Supabase compartido.
