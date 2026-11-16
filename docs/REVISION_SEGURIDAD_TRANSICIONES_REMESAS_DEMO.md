# Revisión de autorización e idempotencia de remesas ficticias

Fecha: 2026-11-16. Inspección de solo lectura del código SQL y de los índices de Supabase.

## Evidencia revisada

- `public.mwd_owner_remittance_transition_demo` llama a `mwd_remittance_demo_private.assert_owner()` antes de acceder a la orden.
- `assert_owner()` obtiene `auth.uid()` y exige que exista un registro `role='owner'` para ese usuario en `public.mwd_admin_roles`. Un usuario sin autorización recibe error `42501`.
- La transición obtiene la orden con `FOR UPDATE`, impidiendo que dos transiciones de la misma orden modifiquen simultáneamente su estado sin serialización de esa fila.
- Una transición repetida con el mismo `request_id` y estado objetivo devuelve `already_processed:true`. Reutilizar la clave con otro estado se rechaza.
- El índice único `mwd_remittance_demo_event_request_once` protege `(order_id, request_id)` en eventos.
- El índice único parcial `mwd_remittance_demo_one_simulated_completion` protege `(order_id)` para eventos con `to_status='simulated'`.
- El índice único `mwd_remittance_demo_idempotent_create` protege `(created_by, request_id)` en órdenes.
- La función devuelve `real_payments_enabled:false` y `redeemable:false`.

## Pruebas pendientes

1. Reintentar en paralelo el mismo cambio de estado con el mismo `request_id`: verificar un solo evento.
2. Intentar dos transiciones diferentes de la misma orden en paralelo: verificar solo las transiciones válidas y ningún doble cierre.
3. Repetir `request_id` con un estado distinto: comprobar rechazo.
4. Intentar una transición como usuario autenticado sin rol de propietario: comprobar error de autorización.
5. Auditar que las respuestas de reintentos reflejen el estado actual de la orden y que el cliente no interprete `already_processed` como éxito de una transición distinta.

## Límites de esta revisión

No se han ejecutado RPC concurrentes ni se han modificado registros. Los índices y bloqueos inspeccionados son defensas existentes, pero no certifican el flujo completo. Las pruebas activas deben hacerse en laboratorio aislado con datos ficticios y autorización antes de alterar datos.
