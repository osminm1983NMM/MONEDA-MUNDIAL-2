# Revisión técnica de recuperación de transferencias — 2026-11-21

## Cambios preparados

En esta rama, `App.js` guarda antes del RPC la operación pendiente en AsyncStorage, bajo una clave asociada al ID de usuario. Al iniciar sesión o reintentar, consulta `mwd_operation_status_demo` con el mismo ID idempotente.

- Si Supabase informa que se procesó, la app compara tipo, importe y destinatario, actualiza saldo/historial y elimina la referencia.
- Si no aparece procesada, conserva los datos y reintenta con el mismo ID.
- Mientras exista una operación sin resolver, bloquea transferencias y aportaciones nuevas.
- Los retiros DEMO también guardan el ID idempotente y los datos por usuario en AsyncStorage antes de llamar al RPC; tras reiniciar se puede reintentar sin crear otra orden.
- Un bloqueo síncrono impide que dos toques rápidos inicien solicitudes distintas antes del siguiente render de React.
- Si el RPC informa que la orden ya existía, no devuelve otra vez el código de retiro. La interfaz dirige a “Mis retiros” y advierte que no se cree otra orden para recuperarlo.
- Las respuestas tardías de transferencias, conversiones y retiros se descartan si la sesión cambió; los indicadores de carga también quedan aislados por usuario.
- La recuperación valida de nuevo la sesión después de leer o borrar la referencia local y después de actualizar el saldo, para no cambiar el estado visible de otra cuenta.

## Comprobaciones ejecutadas

Pasaron localmente y en GitHub Actions las auditorías estáticas y de regresión, incluyendo las nuevas comprobaciones de cambio de cuenta. CI también instaló dependencias y exportó correctamente el bundle JavaScript de Android mediante Expo:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs` (incluye guardas de sesión y reintento de retiros)
- `node scripts/preflight-release-local.js`
- `npx expo export --platform android --output-dir /tmp/mwd-demo-bundle` (ejecutado en CI)

Ejecuciones de CI:
- [Preflight integral DEMO — bundle Android y auditorías](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44852837992)
- [Auditoría estática DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44852837983)

La ejecución del preflight terminó correctamente, incluyendo el paso de bundle de Expo. Esto valida el empaquetado JavaScript; no genera ni prueba una APK.

## Conciliación de Supabase, solo lectura

Revisión agregada del 2026-11-21: 19 transferencias; 0 sin asiento contable; 0 asientos desequilibrados o con estructura incorrecta; 0 claves idempotentes duplicadas.

## Pendiente

No se hizo una prueba en Android ni una prueba integrada de pérdida de conexión/reinicio para transferencias o retiros; el flujo sigue siendo solo de demostración. No se modificó Supabase ni la rama principal. El cambio permanece en un PR de borrador hacia la rama de auditoría, no hacia `main`. El proyecto no está aprobado para mover dinero real.
