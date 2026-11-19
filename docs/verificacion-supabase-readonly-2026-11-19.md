# Verificación directa Supabase — 2026-11-19

Proyecto `egrsdrlpavrtbgxoyxvg`. Inspección **solo lectura** de catálogos PostgreSQL (`pg_proc`, `pg_policies`, `pg_indexes`, `pg_class`); ninguna transferencia ni cambio de datos fue ejecutado.

## Confirmado

- Proyecto `ACTIVE_HEALTHY` al consultar la conexión.
- RLS activo en `mwd_wallets`, `mwd_operations` y `mwd_admin_roles`.
- Políticas SELECT autenticadas: billetera y rol solo propios (`auth.uid() = user_id`); operaciones cuando usuario es origen o destino.
- `mwd_transfer_demo`, `mwd_contribute_demo` y `mwd_operation_status_demo` existen, son `SECURITY DEFINER`, con `search_path` vacío; `anon` sin EXECUTE y `authenticated` con EXECUTE.
- Funciones de escritura comprueban `auth.uid()` y cantidad válida; transferencias bloquean filas de ambas billeteras en orden, comprueban saldo y comparan tipo/destino/cantidad cuando el request_id ya existe.
- Índice único `mwd_unique_request` en `(actor_id, request_id)` proporciona defensa adicional contra duplicación; escrituras y registro de operación ocurren dentro de la misma transacción de función.
- `mwd_operation_status_demo` consulta operaciones por `actor_id=auth.uid()` y `request_id`; responde `processed` o `unconfirmed`.

## Límites de lo demostrado

- La revisión del código y catálogos **no sustituye** prueba concurrente, interrupción de conexión, reinicio Android ni test con sesiones autenticadas de A y B.
- Las funciones `SECURITY DEFINER` merecen revisión de permisos completa; no se deben asumir seguras por el mero hecho de exigir autenticación.
- La rama `dev/recuperacion-transferencias` ya implementa almacenamiento del request_id antes de llamar RPC y recuperación; evitar reimplementar innecesariamente.

## Siguientes pasos

1. Probar con cuentas ficticias A/B la idempotencia simultánea y los errores de red, sin dinero real.
2. Confirmar la UX de sincronización fallida y recuperación del mismo request_id.
3. Validar APK Android en dispositivo/emulador y auditar otros RPC `SECURITY DEFINER` antes de ampliar acceso.

No se activaron recursos de pago ni se modificó `main`.
