# Revisión técnica de recuperación de transferencias — 2026-11-21

## Cambios preparados

En esta rama, `App.js` guarda antes del RPC la operación pendiente en AsyncStorage, bajo una clave asociada al ID de usuario. Al iniciar sesión o reintentar, consulta `mwd_operation_status_demo` con el mismo ID idempotente.

- Si Supabase informa que se procesó, la app compara tipo, importe y destinatario, actualiza saldo/historial y elimina la referencia.
- Si no aparece procesada, conserva los datos y reintenta con el mismo ID.
- Mientras exista una operación sin resolver, bloquea transferencias y aportaciones nuevas.
- Las respuestas tardías de transferencias, conversiones y retiros se descartan si la sesión cambió; los indicadores de carga también quedan aislados por usuario.

## Comprobaciones ejecutadas

Pasaron localmente y en GitHub Actions las auditorías estáticas y de regresión, incluyendo las nuevas comprobaciones de cambio de cuenta:

- `node scripts/audit-demo-static.cjs`
- `node scripts/audit-regression-safety.cjs`
- `node scripts/preflight-release-local.js`

Ejecuciones de CI:
- [Preflight integral DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44850789595)
- [Auditoría estática DEMO](https://github.com/osminm1983NMM/MONEDA-MUNDIAL-2/actions/runs/44850789493)

Ambas terminaron correctamente. También se corrigió una comprobación que interpretaba una mención literal a `service_role` en un comentario como una clave incrustada.

## Conciliación de Supabase, solo lectura

Revisión agregada del 2026-11-21: 19 transferencias; 0 sin asiento contable; 0 asientos desequilibrados o con estructura incorrecta; 0 claves idempotentes duplicadas.

## Pendiente

No se hizo una prueba en Android ni una prueba integrada de pérdida de conexión; el flujo sigue siendo solo de demostración. No se modificó Supabase ni la rama principal. El cambio permanece en un PR de borrador hacia la rama de auditoría, no hacia `main`. El proyecto no está aprobado para mover dinero real.
