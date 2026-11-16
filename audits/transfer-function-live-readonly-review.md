# Auditoría de `public.mwd_transfer_demo` — consulta de solo lectura (2026-11-16)

Se inspeccionó `pg_get_functiondef` directamente en Supabase principal con SELECT; no se ejecutaron transferencias ni escrituras.

## Observaciones del código actual
- `SECURITY DEFINER` con `search_path=''`; usa `auth.uid()` para identificar actor.
- Rechaza request UUID nulo, importe nulo, importe fuera de 1..100000000 centavos, destinatario nulo o código mayor a 40 caracteres.
- Resuelve `account_code` normalizado; rechaza destino inexistente y autoenvío.
- Bloquea billeteras origen y destino en orden de UUID mediante `FOR UPDATE` y exige dos filas.
- Tras bloqueo, busca operación previa por actor y request_id; reintento con mismos parámetros devuelve `already_processed`, con parámetros distintos lanza error.
- Comprueba fondos y límite de saldo destinatario antes de debitar/acreditar e insertar `mwd_operations`.

## Riesgos y verificaciones pendientes
1. Probar **esta función exacta** en PostgreSQL aislado con implementación sintética de `auth.uid()` y tablas equivalentes, incluyendo concurrencia, idempotencia, request_id reutilizado y rollback al fallar el INSERT de operación.
2. Verificar índice único efectivo de `(actor_id,request_id)` y restricciones de operaciones/billeteras en base real, no inferirlo solo del código.
3. Confirmar límites de cuenta, exposición `EXECUTE` y protección RLS/GRANT de tablas subyacentes; `SECURITY DEFINER` requiere especial cuidado.
4. Revisar el tratamiento de espacios en código de destinatario, límites de importe, mensajes de error y fugas de información.
5. La prueba anterior `tests/postgres-transfer-concurrency.sh` usa `test_atomic_transfer`, **no** `mwd_transfer_demo`.

**No desplegar cambios en Supabase principal sin pruebas y autorización.**
