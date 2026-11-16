# Revisión de concurrencia de creación de retiros DEMO

Fecha: 2026-11-16. Fuente: definición actual de `public.mwd_pickup_create_demo` inspeccionada en Supabase (solo lectura).

## Protecciones comprobadas en código

- Requiere `auth.uid()` y valida país de dos letras, monto ficticio de 100 a 100000 centavos e identificador UUID.
- Usa `pg_advisory_xact_lock(hashtextextended(v_user::text, 4107))` para serializar las solicitudes de un mismo usuario dentro de la transacción.
- Reutilizar un `p_request_id` con datos idénticos devuelve `already_created`; reutilizarlo con datos distintos genera error.
- Existe índice único `(sender_user_id, client_request_id)` y el INSERT incluye `ON CONFLICT ... DO NOTHING` con recuperación del registro existente.
- Impone máximo de cinco órdenes ficticias por usuario en la última hora.
- Crea evento `created` en la misma función de base de datos; devuelve explícitamente `realPaymentsEnabled:false`, `isFunded:false`, `canPayOut:false`.
- `mwd_pickup_my_orders_demo` filtra órdenes por `sender_user_id=auth.uid()` y limita a 50.

## Riesgos y pruebas pendientes

- La inspección estática no prueba concurrencia real. Ejecutar dos o más RPC simultáneas con el MISMO usuario e identificador y verificar una sola orden y un solo evento de creación.
- Ejecutar dos RPC con mismo identificador pero distinto monto y confirmar que una se rechaza sin crear otra orden.
- Ejecutar varias solicitudes con identificadores distintos para verificar el límite horario de cinco sin saltos bajo concurrencia.
- Usar DOS cuentas de prueba para verificar aislamiento entre usuarios y que una no pueda consultar o cancelar órdenes de la otra.
- Confirmar que la operación de creación no afecta balances ficticios ni reales y que ninguna ruta de pago está habilitada.
- Las pruebas deben utilizar datos de laboratorio y no alterar los saldos existentes. No ejecutar cargas concurrentes en producción sin autorización específica.

## Alcance

Análisis de lectura únicamente; no se cambiaron funciones, índices, permisos ni saldos. Esta revisión no certifica idempotencia o seguridad de extremo a extremo.
