# Cierre técnico DEMO — Android

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
- Comprobaciones del ejecutor aprobadas con psql simulado: sintaxis, rechazo sin confirmación, selección de 13 archivos, parada ante fallo, detección de archivo ausente y no herencia de parámetros remotos. Pendiente ejecución integrada con PostgreSQL aislado; no se han validado concurrencia ni operaciones nuevas.

## Validación Android

Ejecutar manualmente `validar-demo.yml` en `dev/cierre-android-20261125`. Exigir éxito de pruebas Node, dependencias Expo y exportación Android antes de solicitar APK. Probar en dispositivo dos cuentas, transferencia, aportación, retiro, conversión, pérdida de red, cierre y reapertura, cambio de cuenta y recuperación de contraseña. No habilitar dinero real ni fusionar main hasta revisión.
