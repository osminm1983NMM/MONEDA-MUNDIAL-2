# Revisión técnica de recuperación de transferencias — 2026-11-21

## Cambio preparado

En esta rama, `App.js` guarda antes del RPC la operación pendiente en AsyncStorage, bajo una clave asociada al ID de usuario. Al iniciar sesión o reintentar, consulta `mwd_operation_status_demo` con el mismo ID idempotente.

- Si Supabase informa que se procesó, la app compara tipo, importe y destinatario, actualiza saldo/historial y elimina la referencia.
- Si no aparece procesada, conserva los datos y reintenta con el mismo ID.
- Mientras exista una operación sin resolver, bloquea transferencias y aportaciones nuevas.
- El estado se borra de la interfaz al cambiar de usuario; el registro local queda separado por usuario para recuperarlo al volver a iniciar sesión.

## Comprobaciones ejecutadas

Pasaron localmente y en GitHub Actions las tres comprobaciones estáticas:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs`
- `node scripts/preflight-release-local.js`

Ejecución de GitHub Actions: [Preflight integral DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44850018266). Los tres pasos de auditoría/regresión/configuración terminaron correctamente.

Se actualizaron las auditorías estáticas para cubrir persistencia, recuperación del estado y validación de la respuesta. También se ajustó una comprobación que marcaba como secreto una mención literal a `service_role` en un comentario, aunque no hubiese clave incrustada.

## Conciliación de Supabase, solo lectura

Revisión agregada del 2026-11-21: 19 transferencias; 0 sin asiento contable; 0 asientos desequilibrados o con estructura incorrecta; 0 claves idempotentes duplicadas.

## Pendiente

No se hizo una prueba en Android ni una prueba integrada de pérdida de conexión; el flujo sigue siendo solo de demostración. No se modificó Supabase ni la rama principal. El cambio permanece en un PR de borrador hacia la rama de auditoría, no hacia `main`. El proyecto no está aprobado para mover dinero real.
