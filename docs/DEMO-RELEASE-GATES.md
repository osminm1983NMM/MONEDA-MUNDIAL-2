# Cierre técnico DEMO — Android

## Estado consolidado de aceptación — 26 de noviembre de 2026

Esta sección prevalece sobre los estados históricos conservados más abajo. [Registro de aceptación Android](ANDROID-LAB-ACCEPTANCE.md).

| Puerta | Estado verificable |
| --- | --- |
| PostgreSQL 17 aislado: reconstrucción y tres controles funcionales | APROBADA en CI 45840521789 |
| Cuatro reintentos simultáneos y 14 auditorías posteriores | APROBADA en CI 45840521789 |
| Auditoría contable V2 con control negativo y rollback | APROBADA en PostgreSQL aislado; no desplegada |
| Android: dependencias, regresiones Node, auditorías, Expo y prebuild | APROBADA en CI 45840521938 |
| Android: Gradle, artefacto, integridad, instalación y dos aperturas | APROBADA en CI 45840521938; aceptación física pendiente |
| Samsung: transferencia normal, saldo e historial | APROBADA en pruebas físicas anteriores; versión exacta pendiente |
| Samsung: conversión bidireccional, aportación y retiro | APROBADOS en flujos anteriores; versión nueva pendiente |
| Samsung: recuperación de red | APROBADA ante fallo previo al registro; pérdida de respuesta tras commit no certificada físicamente |
| Recuperación de contraseña por correo | Flujo principal demostrado anteriormente; validar candidata exacta y casos negativos |
| Producción, fondos reales y cumplimiento regulatorio | NO AUTORIZADOS |

**Evidencia actual:** [PR 133](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/133), base probada `fc5caa753f6c03f9afd47257a45dec54f4daf698`, head `852c8b21af501212f0153321ac7d4f0b087d793d`. [PostgreSQL aprobado](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45840521789); [Android aprobado](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45840521938). Candidata LAB: [artefacto 15128571164](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45840521938/artifacts/15128571164), vence 2026-12-03 14:41:45 UTC. Checkout temporal de PR 133: `62cd2a5fd80fe54813b0a01e6f61a4b05930b620`; 97 pruebas Android, 27 regresiones adicionales y 24 escenarios de recuperación aprobados, dos aperturas verificadas en emulador. Ver registro de aceptación para huellas SHA-256. Las nuevas pruebas comerciales no forman parte de esta candidata. El APK anterior 45809213055 no certifica la revisión actual.

### Actualización consolidada posterior — 26 de noviembre de 2026

Esta actualización sustituye los estados de la tabla anterior cuando difieren:

| Puerta | Evidencia actual |
| --- | --- |
| Samsung, candidata 62cd2a5 | Identidad visible, transferencia normal de 10 MWD A→B, débito, recepción, historial y cambio de cuenta aprobados; conciliación independiente con Supabase sin diferencias. |
| Contabilidad DEMO compartida | 32 operaciones, 64 asientos MWD, cinco billeteras y 20 conversiones verificadas; cero anomalías en las consultas ejecutadas. |
| PostgreSQL aislado y seguridad ampliada | CI [45851139786](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45851139786) aprobado, incluyendo pruebas comerciales de RLS, mutaciones directas y cancelaciones. |
| Contabilidad de un pago comercial | Identidad exacta de los dos asientos antes del rollback: aprobada en [45853463720](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45853463720). |
| Concurrencia comercial | Aprobada en [45853708137](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45853708137): reintentos simultáneos, bloqueo observado, un solo pago y conciliación posterior. Cinco escenarios de concurrencia aprobados en total. |
| Inventario de RPC privilegiadas | 56 firmas públicas ejecutables por authenticated, incluidas 38 de propietario; cero funciones privilegiadas MWD ejecutables por anon y cero funciones privadas privilegiadas accesibles por authenticated. Control de solo lectura probado en Supabase e incorporado al CI aislado; nueva ejecución pendiente. |
| Android con áreas seguras | Run 45849862040 compiló, verificó procedencia e instaló, pero falló la aceptación visual del emulador. No distribuir. |
| Android con diagnóstico y desplazamiento | Run [45853329867](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45853329867), commit 46adc7bd3602a40073ec364a2f9ea2ad1a9d95dd, en curso al comprobar. Requiere éxito de APK y smoke-test, y aceptación física posterior. |
| Producción | No autorizada. Protección contra contraseñas filtradas y revisión de RPC privilegiadas pendientes; no se desplegó auditoría V2 ni se modificó main. |

El APK 62cd2a5 instalado sigue siendo la candidata física de referencia; no certifica la corrección visual nueva. No desinstalar, borrar datos ni utilizar artefactos de ejecuciones fallidas.

### Protocolo mínimo de aceptación física de la nueva candidata

1. Antes de instalar: exigir éxito del APK y del emulador, verificar SHA256.txt, COMMIT.txt, DEPENDENCIES-SHA256.txt y compatibilidad de firma con el LAB anterior. No utilizar una descarga anterior para certificar código nuevo.
2. Instalar como actualización del paquete `com.monedamundial.lab.samsung`. Ante error de instalación o firma, detenerse; no desinstalar ni borrar datos. Confirmar el SHA visible de compilación, abrir dos veces y comprobar acceso.
3. Con dos cuentas DEMO existentes, verificar saldo e historial; cerrar sesión, cambiar de cuenta y comprobar que no se ven datos de la anterior. Usar créditos ficticios y registrar importes e historial, nunca credenciales.
4. Ejecutar una operación pequeña de transferencia; confirmar una sola vez el débito y el crédito. Comprobar recuperación de una referencia tras desconexión y reconexión sin modificar datos de la solicitud. No afirmar que el fallo fue posterior al commit sin evidencia del servidor.
5. Comprobar una conversión en cada dirección, una aportación y creación/listado/cancelación de retiro simulado. Los retiros no deben descontar saldo. Reutilizar casos anteriores como referencia, no como prueba de esta APK.
6. Verificar acceso con la contraseña vigente tras cierre explícito y recuperación por el esquema LAB exacto `com.monedamundial.lab.samsung://auth/reset-password`. No compartir contraseñas, códigos ni enlaces. Un enlace usado o vencido no debe abrir una recuperación nueva.
7. Contrastar evidencia física con consultas agregadas y de solo lectura. Cerrar exclusivamente la aceptación DEMO si cada criterio aplicable tiene evidencia; no fusionar main, desplegar V2 ni habilitar fondos reales por este protocolo.

Las pruebas de CI SQL usan Auth sintético. No sustituyen la validación real de correo, permisos del dispositivo ni cumplimiento regulatorio. 

## Puertas de aceptación

- `tests/sql/demo-accounting-release-gate.sql` — transacción con rollback
- `tests/sql/demo-security-release-gate.sql` — transacción con rollback
- `tests/sql/demo-auth-isolation-gate.sql` — transacción con rollback
- `tests/sql/demo-wallet-isolation-gate.sql` — transacción con rollback
- `tests/sql/demo-conversion-functional-gate.sql` — transacción con rollback
- `tests/sql/demo-transfer-functional-gate.sql` — transacción con rollback
- `tests/sql/demo-remittance-quote-gate.sql` — transacción con rollback
- `tests/sql/demo-contribution-pickup-gate.sql` — transacción con rollback

- `tests/sql/demo-owner-authorization-gate.sql` — solo lectura; 38 RPC × 2 identidades sin rol owner, argumentos nulos.
- `tests/sql/demo-conversion-reconciliation-gate.sql` — solo lectura; correspondencia cotización/ejecución y cuatro asientos por conversión.

## Evidencia 26 de noviembre de 2026

- Ambas pruebas nuevas ejecutadas con éxito en Supabase DEMO: 76 rechazos administrativos esperados; 19 conversiones (10 COIN→STABLE, 9 STABLE→COIN), 76 asientos, cero descuadres, duplicados o saldos negativos detectados.
- Seguridad: 30 avisos informativos RLS sin política, 56 advertencias de SECURITY DEFINER accesibles a authenticated y protección de contraseñas filtradas desactivada. Los 76 rechazos no sustituyen pruebas de argumentos válidos ni de roles específicos. Revisar las funciones restantes y habilitar protección de contraseñas antes de uso real.
- No se efectuaron escrituras de datos ni cambios de esquema; pruebas funcionales con mutaciones pendientes en entorno aislado y pruebas físicas pendientes. Sin nueva compilación ni fusión de main.

## Pruebas adicionales verificadas — 26 de noviembre
- `tests/sql/demo-private-permissions-gate.sql`: 38 relaciones privadas, seis esquemas; excepción limitada a disparadores invoker sin acceso al esquema.
- `tests/sql/demo-historical-recovery-gate.sql`: 28 recuperaciones propias y 28 consultas ajenas bloqueadas; cinco historiales.
- `tests/sql/demo-conversion-recovery-history-gate.sql`: 19 confirmaciones repetidas, seis cotizaciones vencidas rechazadas, 50 consultas/confirmaciones ajenas rechazadas.
- `tests/sql/demo-pickup-recovery-history-gate.sql`: cinco órdenes históricas, tres cancelaciones repetidas, cinco cancelaciones ajenas bloqueadas.
- `tests/sql/demo-transfer-contribution-retry-history-gate.sql`: 22 transferencias y seis aportaciones reintentadas; 28 conflictos de importe rechazados, saldos y recuento de operaciones intactos.

## Ejecución integral
Los archivos históricos con bloqueo de filas requieren transacción de escritura con rollback, pero no crean operaciones nuevas en el camino esperado. Ejecutar por separado de las pruebas funcionales de primera ejecución. Las tres pruebas funcionales de transferencia, conversión y aportación/retiro deben ejecutarse exclusivamente en una base DEMO aislada, con datos ficticios y sin integraciones externas. No usar credenciales de base de datos en la aplicación ni en ejecuciones públicas de CI.

## Ejecutor local de aceptación
- `tests/sql/demo-route-simulation-only-gate.sql`: ejecutado en Supabase, 19 rutas DEMO y cero rutas de pago real.
- `scripts/run-demo-sql-gates.cjs`: requiere PostgreSQL local desechable en 127.0.0.1:54322, base mwd_demo_isolated, rol postgres, datos exclusivamente ficticios y sin túneles ni integraciones externas. Requiere Node y psql.
- Configurar MWD_CONFIRM_ISOLATED=YES_LOCAL_DISPOSABLE y MWD_LOCAL_DB_PASSWORD en el entorno del operador, sin guardar contraseñas en Git. Ejecutar `node scripts/run-demo-sql-gates.cjs historical` (13 archivos) y, por separado, `node scripts/run-demo-sql-gates.cjs functional` (3 archivos). No restaura datos ni crea bases.
- `node --test scripts/test-demo-sql-runner.cjs`: siete pruebas offline ejecutadas y aprobadas con Node 22, usando psql simulado; modos de 13 y 3 archivos, rechazo de modo inválido y credenciales faltantes, archivo ausente, parada ante fallo y destino local fijo. No prueba conexiones reales ni túneles locales. Pendiente ejecución integrada con PostgreSQL aislado; no se han validado concurrencia ni operaciones nuevas.

## Prueba de concurrencia real en PostgreSQL desechable
- `scripts/test-demo-concurrency-local.cjs`: cuatro escenarios de doble envío (transferencia, aportación, conversión y retiro); exige observar espera de bloqueo en pg_stat_activity, verificar la misma referencia y comprobar saldos y número de registros.
- Solo para una base de datos local preparada y desechable con datos sintéticos, sin conexiones externas ni túneles. Usa el mismo destino local y variables de entorno que el ejecutor SQL. El operador debe marcar la base aislada con `COMMENT ON DATABASE mwd_demo_isolated IS 'MWD_DISPOSABLE_CONCURRENCY_TEST_ONLY';` y comprobar que las rutas reales están desactivadas.
- Antes de ejecutar, preparar una base local migrada, vacía y marcada. Con psql conectado exclusivamente a la base desechable local, ejecutar `tests/sql/prepare-disposable-concurrency-fixtures.sql` con ON_ERROR_STOP=1. Crea dos usuarios sintéticos sin contraseña de acceso, inicializa dos billeteras y cuatro saldos COIN/STABLE. No utilizar copias de datos reales ni la base compartida. El ejecutor exige exactamente las dos identidades sintéticas y sus billeteras. La preparación todavía no se ha ejecutado.
- Ejecutar `node scripts/test-demo-concurrency-local.cjs`. Este programa CONFIRMA transacciones de prueba; desechar la base después, incluso si falla. Requiere fixtures con dos billeteras MWD, saldos de conversión, liquidez y una cuenta elegible para retiro.
- Estado: código guardado; ejecución con PostgreSQL real pendiente. No se ha certificado concurrencia ni creado infraestructura adicional.

## Ampliación de cotizaciones internacionales — 26 de noviembre
- `tests/sql/demo-remittance-quote-gate.sql`: 114 cotizaciones aprobadas directamente en Supabase DEMO (19 rutas, dos métodos y tres importes por combinación). Verifica la comisión exacta, total, divisa, privacidad de costos internos, límites y ausencia de tasas FX ficticias para destinos no USD. También rechaza tres importes fuera de rango y un método inválido.
- La prueba no ejecuta remesas reales ni valida integraciones bancarias externas.

## Bloqueos de aceptación pendientes
- No se ha podido confirmar la nueva ejecución del APK a través del conector GitHub; comprobar el workflow apk-demo-gradle directamente en Actions.
- Las pruebas de concurrencia requieren una base aislada preparada. No ejecutar operaciones nuevas contra la base compartida. Si se utiliza una rama temporal de Supabase, obtener confirmación previa del costo y eliminarla cuando finalice la sesión.
- La lista de Redirect URLs de Supabase Auth no puede editarse con las acciones disponibles. Confirmar el esquema LAB exacto en el dashboard y completar una prueba de correo en el Samsung.

## Validación Android

Ejecutar manualmente `validar-demo.yml` en `dev/cierre-android-20261125`. Exigir éxito de pruebas Node, dependencias Expo y exportación Android antes de solicitar APK. Probar en dispositivo dos cuentas, transferencia, aportación, retiro, conversión, pérdida de red, cierre y reapertura, cambio de cuenta y recuperación de contraseña. No habilitar dinero real ni fusionar main hasta revisión.

## Reconstrucción sin Supabase Pro — 26 de noviembre de 2026

- El intento de rama temporal fue rechazado por requisito del plan Pro; no se creó ni se cobró esa rama.
- `database/replay/migration-history-20261126.txt` archiva 39 migraciones registradas; una es duplicada exacta. `database/replay/catalog-missing-objects-20261126.json` conserva definiciones de tres tablas, siete vistas, seis funciones y cuatro disparadores ausentes de las declaraciones CREATE registradas. No se copiaron filas de usuarios ni de transacciones.
- `scripts/build-isolated-demo-sql.cjs` genera 38 bloques de migración distintos y restaura objetos ausentes. Comprobaciones de generación y orden aprobadas; restauración PostgreSQL efectiva pendiente de CI. La recreación no es un respaldo completo de Supabase ni valida Auth/GoTrue: usa un sustituto SQL de auth.uid y una tabla de usuarios sintética. No usar para producción.
- `.github/workflows/demo-postgres-isolated.yml` prepara un servicio PostgreSQL 17 desechable en GitHub Actions sin credenciales de Supabase, ejecuta tres puertas funcionales, cuatro escenarios concurrentes y auditorías posteriores. El flujo se activa por cambios de archivos específicos en la rama de desarrollo. Revisar el resultado de la ejecución antes de aprobar cualquier puerta; no se ha certificado todavía el replay ni la concurrencia.

### Paridad de las funciones SQL — revisión posterior

- Se compararon las definiciones de 73 funciones MWD actuales con el archivo de migraciones. Además de las seis funciones ya recuperadas del catálogo, se detectaron tres cuerpos actualizados fuera del historial: `mwd_get_payment_request_demo`, `mwd_owner_partner_audit_feed_demo` y `mwd_owner_partner_location_save_demo`.
- `database/replay/current-rpc-overrides-20261126.json` conserva sus definiciones actuales; el generador las aplica después de las 38 migraciones distintas y de los objetos restaurados. Se verificó la generación de los tres reemplazos. No equivale a ejecutar PostgreSQL ni certificar paridad total de permisos y datos.
- El entorno actual no tiene PostgreSQL ni Docker. El conector de GitHub no devuelve los resultados de workflows disparados por push mediante la consulta de runs por commit. Verificar la ejecución de `DEMO PostgreSQL aislado` en Actions; no declarar pruebas financieras concurrentes aprobadas hasta disponer de sus logs.

### Evidencia de CI aislada — 26 de noviembre de 2026

- PR de validación en borrador: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/pull/132
- Ejecución: https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45808960480, job 139871471465, commit f0cf7f9eaf9ba8ed93a72d60042d9654c348cae0.
- Reconstrucción del esquema PostgreSQL 17 y creación de usuarios sintéticos: paso 6 completado con éxito.
- Tres puertas funcionales transaccionales: paso 7 completado con éxito.
- Estado observado al registrar: [{"step":"Execute four simultaneous retry scenarios","status":"in_progress","conclusion":null},{"step":"Verify accounting and security after concurrent operations","status":"pending","conclusion":null},{"step":"Acceptance scope","status":"pending","conclusion":null}]. No declarar aprobados pasos sin conclusión success. No se certifica Supabase Auth real ni Android físico.

### Aceptación CI PostgreSQL aislado — COMPLETADA

Ejecución 45808960480, job 139871471465, commit f0cf7f9eaf9ba8ed93a72d60042d9654c348cae0. [Logs de GitHub Actions](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/45808960480/job/139871471465). Conclusión success; se verificaron pasos y logs completos.

- PostgreSQL 17: reconstrucción desde cero y dos usuarios sintéticos aprobados; tres puertas funcionales aprobadas.
- Cuatro escenarios concurrentes aprobados con espera de bloqueo observada: transferencia (un débito/un crédito), aportación (un débito), conversión (una conversión/cuatro asientos), retiro (una orden sin fondos). No equivale a prueba de concurrencia ilimitada ni carga de producción.
- Diez puertas posteriores aprobadas: contabilidad, estructura de seguridad, permisos privados, aislamiento Auth SQL, billeteras, cotizaciones (19 rutas/114 cotizaciones), rutas solo simulación, autorización (38 RPC de propietario, dos identidades no propietarias), recuperación histórica (dos operaciones/dos billeteras) y reintentos históricos (una transferencia/una aportación).
- Los logs confirman eliminación del contenedor y su red. No se creó una rama de Supabase ni se copiaron filas personales. El Auth es un sustituto SQL; quedan pendientes la recuperación por correo real, la verificación de la APK actual y la aceptación física Android. No autoriza dinero real.


## Conciliación de identidad de asientos — 26 de noviembre de 2026

- Nueva puerta [demo-ledger-posting-identity-gate.sql](../tests/sql/demo-ledger-posting-identity-gate.sql), ejecutada directamente en Supabase en transacción de solo lectura: 22 transferencias y 9 aportaciones, 31 operaciones aprobadas, cero discrepancias. Comprueba referencia externa, tipo, moneda, estado posted, dos asientos exactos, importe, lado débito/crédito, cuenta y titular esperados, y cuenta de compensación de aportaciones. No acredita ausencia de asientos huérfanos ni sustituye conciliación de apertura independiente.
- La vista privada demo_operations_audit_v1 conserva la clasificación histórica contribution_requires_accounting_policy; no es la fuente del RPC de alertas del propietario, que consulta demo_ledger_alerts_v1 y demo_wallet_alerts_v1. No se modificó la vista en Supabase ni se ocultaron alertas. Revisar dependencias y probar cualquier reemplazo de la vista en un entorno aislado antes de desplegar.
- La nueva puerta se incluyó en la ejecución histórica local (15 puertas distintas; secuencia comprobada con psql simulado) y en el workflow PostgreSQL aislado. La conclusión de la nueva ejecución de CI aún no está confirmada. No se cambió main ni datos, esquema o saldos de Supabase. Solo DEMO.


## Cobertura inversa del libro contable — 26 de noviembre de 2026

- Nueva prueba [demo-ledger-reverse-coverage-gate.sql](../tests/sql/demo-ledger-reverse-coverage-gate.sql), aprobada directamente en Supabase en transacción repetible de solo lectura: 5 billeteras, 31 transacciones MWD y 62 asientos. Cero transacciones MWD huérfanas/no contabilizadas, asientos con referencias inexistentes o moneda incompatible, cuentas de pasivo de clientes MWD sin billetera, ni diferencias de saldo al reconstruir desde el saldo inicial DEMO configurado de 1,000,000 centavos más los movimientos de libro contable.
- El control es complementario a la prueba de identidad de asientos; no demuestra existencia de fondos reales ni un saldo inicial verificado por fuente independiente. El modelo usa exclusivamente el saldo ficticio configurado. No se modificó la vista heredada, la base de datos ni saldos.
- Integración guardada en el workflow PostgreSQL aislado y el ejecutor histórico local (16 puertas distintas, secuencia comprobada con psql simulado). La nueva ejecución CI y los escenarios negativos con datos alterados en entorno aislado todavía requieren verificación. No se modifica main ni Android.


## Recuperación ante fallo de almacenamiento Android — 26 de noviembre de 2026

- App.js distingue fallo previo a comprobar la referencia durable de fallo de respuesta RPC. Transferencia/aportación y retiro no se envían si falla la lectura o escritura inicial de AsyncStorage; se muestra un mensaje específico y se exige revisión de la referencia antes de otra operación. No se modifica la referencia del servidor ni se borra almacenamiento ante fallo.
- Cuatro escenarios ejecutados con cuerpos reales de las funciones y dobles de AsyncStorage/RPC: getItem y setItem rechazados en transferencia y retiro; cero llamadas RPC y liberación de bloqueo en los cuatro casos. Se agregaron pruebas de regresión a scripts/test-transfer-recovery.cjs y scripts/test-conversion-retiro.cjs. Se corrigió el arnés de refreshAccount para cargar syncErrorMessage tras el cambio de localización.
- Cambios guardados en rama dev/cierre-android-20261125; no se ejecutó la suite completa de Node ni se verificó el APK nuevo, CI o comportamiento físico. No se modificaron main ni Supabase. No habilitar fondos reales.


## Regresión integral offline y separación de CI — 26 de noviembre de 2026

- Se ejecutaron los cuerpos de los scripts y pruebas recuperados desde GitHub en un entorno JavaScript con adaptadores para fs, assert, vm, test, URL, temporizador y AbortController; no equivale a ejecución nativa de Node. 44 casos Android, 11 de transferencia, 9 de conversión/retiro, 7 del ejecutor SQL simulado y 12+12 de recuperación normal/LAB: 95 escenarios aprobados. Auditorías estáticas: 159 y 103 aserciones aprobadas; preflight: 8 comprobaciones aprobadas. La variante LAB se evaluó con el reemplazo del esquema en memoria, como en CI. Sin acceso directo de red al repositorio desde el contenedor local.
- El workflow de auditoría offline ejecutaba indiscriminadamente scripts/test-*.cjs, incluyendo la prueba de concurrencia que requiere PostgreSQL aislado. Se sustituyó por una lista explícita de pruebas sin base de datos, se incorporaron casos Android, preflight y recuperación LAB, y se ampliaron los filtros de archivos. Concurrencia queda en el workflow PostgreSQL aislado. Commit 8ce8628c6f2a69882209e0ceb326f6bce41cdfc1, blob verificado 5e244073d091f059e56be08339ac1b94f327ce22. La consulta de runs no devolvió ejecución asociada; CI nativo y APK actualizado siguen pendientes.
- No se modificó App.js, main, Supabase, datos ni saldos en esta sesión. Solo DEMO.
