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

## Validación Android

Ejecutar manualmente `validar-demo.yml` en `dev/cierre-android-20261125`. Exigir éxito de pruebas Node, dependencias Expo y exportación Android antes de solicitar APK. Probar en dispositivo dos cuentas, transferencia, aportación, retiro, conversión, pérdida de red, cierre y reapertura, cambio de cuenta y recuperación de contraseña. No habilitar dinero real ni fusionar main hasta revisión.
