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

## Validación Android

Ejecutar manualmente `validar-demo.yml` en `dev/cierre-android-20261125`. Exigir éxito de pruebas Node, dependencias Expo y exportación Android antes de solicitar APK. Probar en dispositivo dos cuentas, transferencia, aportación, retiro, conversión, pérdida de red, cierre y reapertura, cambio de cuenta y recuperación de contraseña. No habilitar dinero real ni fusionar main hasta revisión.
